/* ============================================================
   PASCUA JUVENIL 2026 — Frontend Script
   Archivo: script.js
   ============================================================ */

'use strict';

// ── CONFIGURACIÓN ─────────────────────────────────────────────
// ⚠️  IMPORTANTE: Reemplaza este valor con la URL de tu Web App
//    desplegada en Google Apps Script.
//    Pasos: Apps Script → Implementar → Nueva implementación
//           → Tipo: App web → Acceso: Cualquier persona
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwkE150ZRBKWch2JkMdyIH0UIaWI-whd18P5ZbsKewN9qtysD9Kvu0SlFqlXiwwiM0I/exec';

// Categorías y etiquetas
const CATEGORY_LABELS = {
  IPISA:      'Estudiante IPISA',
  IPIDBOSCO:  'Estudiante IPIDBOSCO',
  EXTERNO:    'Invitado Externo',
};

const CATEGORY_ICONS = {
  IPISA:      'fa-graduation-cap',
  IPIDBOSCO:  'fa-book-open',
  EXTERNO:    'fa-star',
};

// ── ESTADO ────────────────────────────────────────────────────
const state = {
  selectedCategory: null,
  currentStep: 1,   // 1 = categoría, 2 = nombre, 3 = éxito
};

// ── REFERENCIAS DOM ───────────────────────────────────────────
const dom = {
  // Tabs
  navTabs:         document.querySelectorAll('.nav__tab'),
  tabRegister:     document.getElementById('tab-register'),
  tabGroups:       document.getElementById('tab-groups'),

  // Steps
  stepCategory:    document.getElementById('step-category'),
  stepName:        document.getElementById('step-name'),
  stepSuccess:     document.getElementById('step-success'),

  // Category cards
  categoryCards:   document.querySelectorAll('.category-card'),

  // Name form
  selectedBadge:   document.getElementById('selected-badge'),
  fullnameInput:   document.getElementById('fullname'),
  nameError:       document.getElementById('name-error'),
  btnBack:         document.getElementById('btn-back'),
  btnSubmit:       document.getElementById('btn-submit'),

  // Success
  successMsg:      document.getElementById('success-msg'),
  successResult:   document.getElementById('success-result'),
  btnNewRegister:  document.getElementById('btn-new-register'),

  // Loading
  registerLoading: document.getElementById('register-loading'),
  groupsLoading:   document.getElementById('groups-loading'),

  // Groups
  groupsGrid:      document.getElementById('groups-grid'),
  btnRefresh:      document.getElementById('btn-refresh'),
  statTotal:       document.getElementById('stat-total'),
  statIpisa:       document.getElementById('stat-ipisa'),
  statIpidbosco:   document.getElementById('stat-ipidbosco'),
  statExterno:     document.getElementById('stat-externo'),

  // Toast
  toast:           document.getElementById('toast'),
  toastMsg:        document.getElementById('toast-msg'),
};

// ── INIT ──────────────────────────────────────────────────────
function init() {
  bindNavTabs();
  bindCategoryCards();
  bindBackButton();
  bindSubmitButton();
  bindNewRegister();
  bindRefreshGroups();
}

// ── NAV TABS ──────────────────────────────────────────────────
function bindNavTabs() {
  dom.navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;

      dom.navTabs.forEach(t => t.classList.remove('nav__tab--active'));
      tab.classList.add('nav__tab--active');

      dom.tabRegister.classList.remove('tab-content--active');
      dom.tabGroups.classList.remove('tab-content--active');

      if (target === 'register') {
        dom.tabRegister.classList.add('tab-content--active');
      } else if (target === 'groups') {
        dom.tabGroups.classList.add('tab-content--active');
        loadGroups();
      }
    });
  });
}

// ── CATEGORY SELECTION ────────────────────────────────────────
function bindCategoryCards() {
  dom.categoryCards.forEach(card => {
    card.addEventListener('click', () => {
      const category = card.dataset.category;
      if (!category) return;

      state.selectedCategory = category;
      updateSelectedBadge(category);
      goToStep(2);
    });
  });
}

function updateSelectedBadge(category) {
  const icon  = CATEGORY_ICONS[category]  || 'fa-user';
  const label = CATEGORY_LABELS[category] || category;
  dom.selectedBadge.innerHTML =
    `<i class="fas ${icon}"></i> ${label}`;
}

// ── STEP NAVIGATION ───────────────────────────────────────────
function goToStep(step) {
  state.currentStep = step;

  dom.stepCategory.classList.remove('form-step--active');
  dom.stepName.classList.remove('form-step--active');
  dom.stepSuccess.classList.remove('form-step--active');

  if (step === 1) {
    dom.stepCategory.classList.add('form-step--active');
    clearNameField();
  } else if (step === 2) {
    dom.stepName.classList.add('form-step--active');
    setTimeout(() => dom.fullnameInput.focus(), 50);
  } else if (step === 3) {
    dom.stepSuccess.classList.add('form-step--active');
  }
}

function bindBackButton() {
  dom.btnBack.addEventListener('click', () => {
    clearNameField();
    goToStep(1);
  });
}

// ── FORM VALIDATION ───────────────────────────────────────────
function validateName(value) {
  const trimmed = value.trim();
  if (!trimmed)         return 'El nombre completo es obligatorio.';
  if (trimmed.length < 3) return 'El nombre debe tener al menos 3 caracteres.';
  if (trimmed.length > 100) return 'El nombre no puede exceder 100 caracteres.';
  if (!/[a-záéíóúüñA-ZÁÉÍÓÚÜÑ]/.test(trimmed))
    return 'Ingresa un nombre válido.';
  return null;
}

function showFieldError(message) {
  dom.nameError.textContent   = message ? `\u2022 ${message}` : '';
  dom.fullnameInput.classList.toggle('is-error', !!message);
}

function clearNameField() {
  dom.fullnameInput.value = '';
  showFieldError(null);
}

// ── SUBMIT REGISTRATION ───────────────────────────────────────
function bindSubmitButton() {
  dom.btnSubmit.addEventListener('click', handleSubmit);
  dom.fullnameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSubmit();
  });
  dom.fullnameInput.addEventListener('input', () => {
    if (dom.fullnameInput.classList.contains('is-error')) {
      showFieldError(validateName(dom.fullnameInput.value));
    }
  });
}

async function handleSubmit() {
  const name  = dom.fullnameInput.value.trim();
  const error = validateName(name);

  if (error) {
    showFieldError(error);
    dom.fullnameInput.focus();
    return;
  }

  if (!state.selectedCategory) {
    showToast('Por favor selecciona una categoría primero.', 'error');
    goToStep(1);
    return;
  }

  showLoading(dom.registerLoading);
  dom.btnSubmit.disabled = true;

  try {
    const result = await apiPost({
      action:   'register',
      name:     name,
      category: state.selectedCategory,
    });

    if (!result.ok) throw new Error(result.error || 'Error desconocido.');

    showSuccessStep(result.data);
  } catch (err) {
    showToast(err.message || 'Error al conectar con el servidor.', 'error');
  } finally {
    hideLoading(dom.registerLoading);
    dom.btnSubmit.disabled = false;
  }
}

function showSuccessStep(data) {
  const catLabel = CATEGORY_LABELS[data.category] || data.category;
  const catIcon  = CATEGORY_ICONS[data.category]  || 'fa-user';

  dom.successMsg.textContent = `¡Bienvenido/a, ${data.name}!`;

  dom.successResult.innerHTML = `
    <div class="result-chip">
      <span class="result-chip__label"><i class="fas fa-id-badge"></i> Nombre</span>
      <span class="result-chip__value" style="font-size:1rem">${escapeHtml(data.name)}</span>
    </div>
    <div class="result-chip">
      <span class="result-chip__label"><i class="fas ${catIcon}"></i> Categoría</span>
      <span class="result-chip__value" style="font-size:.9rem">${catLabel}</span>
    </div>
    <div class="result-chip result-chip--group">
      <span class="result-chip__label"><i class="fas fa-users"></i> Tu Grupo</span>
      <span class="result-chip__value">${data.group}</span>
    </div>
  `;

  goToStep(3);
}

// ── NEW REGISTER ──────────────────────────────────────────────
function bindNewRegister() {
  dom.btnNewRegister.addEventListener('click', () => {
    state.selectedCategory = null;
    clearNameField();
    goToStep(1);
  });
}

// ── GROUPS ────────────────────────────────────────────────────
function bindRefreshGroups() {
  dom.btnRefresh.addEventListener('click', () => loadGroups(true));
}

async function loadGroups(forceRefresh = false) {
  if (dom.groupsGrid.dataset.loaded && !forceRefresh) return;

  showLoading(dom.groupsLoading);
  dom.btnRefresh.disabled = true;

  try {
    const result = await apiGet('getGroups');
    if (!result.ok) throw new Error(result.error || 'Error al obtener grupos.');

    renderGroups(result.data);
    updateStats(result.data);
    dom.groupsGrid.dataset.loaded = '1';
  } catch (err) {
    showToast(err.message || 'Error al cargar los grupos.', 'error');
    if (!dom.groupsGrid.dataset.loaded) {
      dom.groupsGrid.innerHTML = buildEmptyGroupsMessage();
    }
  } finally {
    hideLoading(dom.groupsLoading);
    dom.btnRefresh.disabled = false;
  }
}

function renderGroups(groups) {
  if (!groups || !groups.length) {
    dom.groupsGrid.innerHTML = buildEmptyGroupsMessage();
    return;
  }

  dom.groupsGrid.innerHTML = groups.map(g => buildGroupCard(g)).join('');
}

function buildGroupCard(group) {
  const total     = group.counts.total || 0;
  const ipisaC    = group.counts.IPISA      || 0;
  const ipidC     = group.counts.IPIDBOSCO  || 0;
  const externoC  = group.counts.EXTERNO    || 0;

  const membersHtml = group.members && group.members.length
    ? group.members.map(m => {
        const initials = getInitials(m.name);
        const catLabel = getCatShort(m.category);
        return `
          <div class="member-row">
            <div class="member-row__avatar member-row__avatar--${m.category}">
              ${initials}
            </div>
            <span class="member-row__name" title="${escapeHtml(m.name)}">${escapeHtml(m.name)}</span>
            <span class="member-row__cat">${catLabel}</span>
          </div>
        `;
      }).join('')
    : `<div class="group-card__empty">
         <i class="fas fa-user-slash"></i> Sin integrantes aún
       </div>`;

  return `
    <div class="group-card">
      <div class="group-card__header">
        <div class="group-card__number">
          <div class="group-card__num-badge">${group.number}</div>
          <span class="group-card__title">Grupo ${group.number}</span>
        </div>
        <span class="group-card__count">${total} integrante${total !== 1 ? 's' : ''}</span>
      </div>
      <div class="group-card__cats">
        ${ipisaC   > 0 ? `<span class="cat-badge cat-badge--IPISA"><i class="fas fa-graduation-cap"></i>${ipisaC}</span>` : ''}
        ${ipidC    > 0 ? `<span class="cat-badge cat-badge--IPIDBOSCO"><i class="fas fa-book-open"></i>${ipidC}</span>` : ''}
        ${externoC > 0 ? `<span class="cat-badge cat-badge--EXTERNO"><i class="fas fa-star"></i>${externoC}</span>` : ''}
        ${total === 0  ? `<span style="font-size:.75rem;color:var(--text-muted)"><i class="fas fa-circle-xmark"></i> Vacío</span>` : ''}
      </div>
      <div class="group-card__members">
        ${membersHtml}
      </div>
    </div>
  `;
}

function buildEmptyGroupsMessage() {
  return `
    <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted)">
      <i class="fas fa-users" style="font-size:2.5rem;margin-bottom:12px;opacity:.3;display:block"></i>
      <p>Aún no hay participantes registrados.</p>
      <p style="font-size:.82rem;margin-top:4px">¡Sé el primero en registrarte!</p>
    </div>
  `;
}

function updateStats(groups) {
  const stats = { total: 0, IPISA: 0, IPIDBOSCO: 0, EXTERNO: 0 };
  groups.forEach(g => {
    stats.total     += g.counts.total     || 0;
    stats.IPISA     += g.counts.IPISA     || 0;
    stats.IPIDBOSCO += g.counts.IPIDBOSCO || 0;
    stats.EXTERNO   += g.counts.EXTERNO   || 0;
  });

  dom.statTotal.textContent     = stats.total;
  dom.statIpisa.textContent     = stats.IPISA;
  dom.statIpidbosco.textContent = stats.IPIDBOSCO;
  dom.statExterno.textContent   = stats.EXTERNO;
}

// ── API HELPERS ───────────────────────────────────────────────
async function apiGet(action) {
  const url = `${SCRIPT_URL}?action=${encodeURIComponent(action)}`;
  const res  = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiPost(body) {
  const res = await fetch(SCRIPT_URL, {
    method:   'POST',
    redirect: 'follow',
    body:     JSON.stringify(body),
    // Note: Content-Type omitted intentionally to avoid preflight CORS issues
    // GAS parses e.postData.contents regardless of Content-Type header
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── UI HELPERS ────────────────────────────────────────────────
function showLoading(el) {
  if (el) el.classList.add('is-visible');
}
function hideLoading(el) {
  if (el) el.classList.remove('is-visible');
}

let toastTimer = null;
function showToast(message, type = 'error') {
  dom.toastMsg.textContent = message;

  const icon = dom.toast.querySelector('.toast__icon');
  if (icon) {
    icon.className = `fas toast__icon ${
      type === 'error'   ? 'fa-circle-exclamation' :
      type === 'success' ? 'fa-circle-check'       :
                           'fa-circle-info'
    }`;
  }

  dom.toast.classList.remove('toast--error', 'toast--success', 'toast--info');
  dom.toast.classList.add(`toast--${type}`, 'is-visible');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.remove('is-visible'), 4000);
}

function getInitials(name) {
  return (name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0] || '')
    .join('')
    .toUpperCase();
}

function getCatShort(category) {
  const map = {
    IPISA:     'IPISA',
    IPIDBOSCO: 'IPID',
    EXTERNO:   'EXT',
  };
  return map[category] || category;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── START ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);