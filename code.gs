// ============================================================
//  PASCUA JUVENIL 2026 — Google Apps Script Backend
//  Archivo: Code.gs
// ============================================================

// ── CONSTANTES ──────────────────────────────────────────────
var SHEET_PARTICIPANTS = "Participantes";
var SHEET_CONFIG       = "Configuracion";
var TOTAL_GROUPS       = 28;
var CATEGORIES         = ["IPISA", "IPIDBOSCO", "EXTERNO"];

// ── PUNTO DE ENTRADA HTTP ────────────────────────────────────

/**
 * Maneja peticiones GET.
 * Parámetros: ?action=getGroups | ?action=getStats
 */
function doGet(e) {
  setupSheets();
  var action = e && e.parameter ? e.parameter.action : "getGroups";
  var result;

  try {
    if (action === "getGroups") {
      result = { ok: true, data: getGroupsData() };
    } else if (action === "getStats") {
      result = { ok: true, data: getStats() };
    } else {
      result = { ok: false, error: "Acción no reconocida: " + action };
    }
  } catch (err) {
    result = { ok: false, error: err.message };
  }

  return buildResponse(result);
}

/**
 * Maneja peticiones POST.
 * Body JSON: { action: "register", name: "...", category: "..." }
 */
function doPost(e) {
  setupSheets();
  var result;

  try {
    var payload = JSON.parse(e.postData.contents);
    var action  = payload.action;

    if (action === "register") {
      result = { ok: true, data: registerParticipant(payload.name, payload.category) };
    } else {
      result = { ok: false, error: "Acción no reconocida: " + action };
    }
  } catch (err) {
    result = { ok: false, error: err.message };
  }

  return buildResponse(result);
}

// ── SETUP DE HOJAS ───────────────────────────────────────────

/**
 * Crea las hojas necesarias si no existen.
 * Llamar desde el editor una vez para inicializar, o se llama
 * automáticamente en cada request.
 */
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Hoja: Participantes
  if (!ss.getSheetByName(SHEET_PARTICIPANTS)) {
    var sh = ss.insertSheet(SHEET_PARTICIPANTS);
    sh.appendRow(["ID", "Nombre", "Categoria", "Grupo", "Timestamp"]);
    sh.setFrozenRows(1);

    // Formato de cabecera
    var header = sh.getRange(1, 1, 1, 5);
    header.setBackground("#1E3A5F");
    header.setFontColor("#FFFFFF");
    header.setFontWeight("bold");
    sh.setColumnWidth(1, 80);
    sh.setColumnWidth(2, 220);
    sh.setColumnWidth(3, 120);
    sh.setColumnWidth(4, 80);
    sh.setColumnWidth(5, 180);
  }

  // Hoja: Configuración (guarda el último grupo asignado)
  if (!ss.getSheetByName(SHEET_CONFIG)) {
    var cfg = ss.insertSheet(SHEET_CONFIG);
    cfg.appendRow(["Clave", "Valor"]);
    cfg.appendRow(["ultimo_grupo", 0]);
    cfg.appendRow(["total_registros", 0]);
    cfg.setFrozenRows(1);

    var cfgHeader = cfg.getRange(1, 1, 1, 2);
    cfgHeader.setBackground("#1E3A5F");
    cfgHeader.setFontColor("#FFFFFF");
    cfgHeader.setFontWeight("bold");
  }
}

// ── REGISTRO DE PARTICIPANTES ────────────────────────────────

/**
 * Registra un participante, asigna grupo y guarda en Sheets.
 * @param {string} name     - Nombre completo
 * @param {string} category - IPISA | IPIDBOSCO | EXTERNO
 * @returns {Object} Datos del participante registrado
 */
function registerParticipant(name, category) {
  // Validaciones básicas
  name     = (name || "").toString().trim();
  category = (category || "").toString().trim().toUpperCase();

  if (!name)                          throw new Error("El nombre es obligatorio.");
  if (name.length < 3)                throw new Error("El nombre es demasiado corto.");
  if (CATEGORIES.indexOf(category) === -1)
    throw new Error("Categoría inválida: " + category);

  var ss           = SpreadsheetApp.getActiveSpreadsheet();
  var shPart       = ss.getSheetByName(SHEET_PARTICIPANTS);
  var participants = getParticipantsRaw(shPart);

  // Último grupo asignado (desde Config)
  var lastGroup    = getConfigValue("ultimo_grupo");
  var totalReg     = getConfigValue("total_registros");

  // Asignar grupo
  var assignedGroup = assignGroup(category, Number(lastGroup), participants);

  // Generar ID
  var newId = Number(totalReg) + 1;

  // Guardar fila
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  shPart.appendRow([newId, name, category, assignedGroup, timestamp]);

  // Actualizar Config
  setConfigValue("ultimo_grupo", assignedGroup);
  setConfigValue("total_registros", newId);

  return {
    id:        newId,
    name:      name,
    category:  category,
    group:     assignedGroup,
    timestamp: timestamp
  };
}

// ── ALGORITMO DE ASIGNACIÓN ──────────────────────────────────

/**
 * Asigna el grupo óptimo para un nuevo participante.
 *
 * Lógica en dos fases:
 *   1. Entre los 28 grupos (excluyendo el último asignado), selecciona
 *      aquellos con el menor número de integrantes de la MISMA categoría.
 *      → Garantiza balance de categorías dentro de cada grupo.
 *   2. Entre los candidatos de la fase 1, prefiere los de menor total.
 *      → Garantiza balance general de tamaño entre grupos.
 *   3. Si persiste empate: selección aleatoria.
 *
 * @param {string} category    - Categoría del nuevo participante
 * @param {number} lastGroup   - Último grupo asignado (excluir)
 * @param {Array}  participants - Lista de participantes existentes
 * @returns {number} Número de grupo (1–28)
 */
function assignGroup(category, lastGroup, participants) {
  // Inicializar contadores
  var counts = {};
  for (var g = 1; g <= TOTAL_GROUPS; g++) {
    counts[g] = { total: 0, IPISA: 0, IPIDBOSCO: 0, EXTERNO: 0 };
  }

  participants.forEach(function(p) {
    var grp = Number(p.group);
    if (grp >= 1 && grp <= TOTAL_GROUPS) {
      counts[grp].total++;
      if (counts[grp][p.category] !== undefined) {
        counts[grp][p.category]++;
      }
    }
  });

  // Fase 1: mínimo de la categoría actual (excluir lastGroup)
  var minCatCount = Infinity;
  for (var g1 = 1; g1 <= TOTAL_GROUPS; g1++) {
    if (g1 === lastGroup) continue;
    var catVal = counts[g1][category] || 0;
    if (catVal < minCatCount) minCatCount = catVal;
  }

  var phase1 = [];
  for (var g2 = 1; g2 <= TOTAL_GROUPS; g2++) {
    if (g2 === lastGroup) continue;
    if ((counts[g2][category] || 0) === minCatCount) {
      phase1.push(g2);
    }
  }

  // Fase 2: mínimo total entre candidatos
  var minTotal = Infinity;
  phase1.forEach(function(g) {
    if (counts[g].total < minTotal) minTotal = counts[g].total;
  });

  var phase2 = phase1.filter(function(g) {
    return counts[g].total === minTotal;
  });

  // Fase 3: aleatorio entre empatados
  return phase2[Math.floor(Math.random() * phase2.length)];
}

// ── LECTURA DE DATOS ─────────────────────────────────────────

/**
 * Devuelve todos los participantes como array de objetos.
 */
function getParticipantsRaw(sheet) {
  var sh   = sheet || SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PARTICIPANTS);
  var last = sh.getLastRow();
  if (last < 2) return [];

  var data = sh.getRange(2, 1, last - 1, 5).getValues();
  return data.map(function(row) {
    return {
      id:        row[0],
      name:      row[1],
      category:  row[2],
      group:     row[3],
      timestamp: row[4]
    };
  });
}

/**
 * Devuelve los 28 grupos con sus integrantes, ordenados por grupo.
 */
function getGroupsData() {
  var participants = getParticipantsRaw();
  var groups = {};

  for (var g = 1; g <= TOTAL_GROUPS; g++) {
    groups[g] = {
      number:  g,
      members: [],
      counts:  { IPISA: 0, IPIDBOSCO: 0, EXTERNO: 0, total: 0 }
    };
  }

  participants.forEach(function(p) {
    var grp = Number(p.group);
    if (grp >= 1 && grp <= TOTAL_GROUPS) {
      groups[grp].members.push({
        id:       p.id,
        name:     p.name,
        category: p.category
      });
      groups[grp].counts[p.category] = (groups[grp].counts[p.category] || 0) + 1;
      groups[grp].counts.total++;
    }
  });

  return Object.values(groups);
}

/**
 * Devuelve estadísticas globales.
 */
function getStats() {
  var participants = getParticipantsRaw();
  var stats = { total: 0, IPISA: 0, IPIDBOSCO: 0, EXTERNO: 0 };
  participants.forEach(function(p) {
    stats.total++;
    if (stats[p.category] !== undefined) stats[p.category]++;
  });
  return stats;
}

// ── CONFIGURACIÓN ────────────────────────────────────────────

function getConfigValue(key) {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var cfg = ss.getSheetByName(SHEET_CONFIG);
  if (!cfg) return 0;
  var data = cfg.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1];
  }
  return 0;
}

function setConfigValue(key, value) {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var cfg = ss.getSheetByName(SHEET_CONFIG);
  if (!cfg) return;
  var data = cfg.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      cfg.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  cfg.appendRow([key, value]);
}

// ── HELPERS ──────────────────────────────────────────────────

function buildResponse(obj) {
  var output = ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ── FUNCIÓN DE PRUEBA (ejecutar desde el editor) ─────────────

function testRegister() {
  setupSheets();
  Logger.log(registerParticipant("Ana García López", "IPISA"));
  Logger.log(registerParticipant("Luis Martínez", "IPIDBOSCO"));
  Logger.log(registerParticipant("Sofía Ramírez", "EXTERNO"));
  Logger.log(getGroupsData());
}