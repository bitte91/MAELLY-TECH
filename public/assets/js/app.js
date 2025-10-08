// BNCC Avançado v2.3 — app.js (ES Module)
/* global html2canvas */
const qs = (s, el=document)=>el.querySelector(s);
const qsa = (s, el=document)=>[...el.querySelectorAll(s)];
const $ = {
  on: (el, ev, fn)=>el.addEventListener(ev, fn),
  el: (tag, attrs={})=>Object.assign(document.createElement(tag), attrs)
};

// ---------- Estado ----------
let appState = {
  selectedSkills: [],
  teaModeActive: false,
  userProfile: { teacher: "Professora", school: "" },
  stats: { skills: 0, items: 0 },
  workspace: { objectives: [], activities: [], games: [], assessments: [] },
  myActivities: [],
  chatbot: {
    messages: [],
    answers: {},
    step: 0,
    active: false,
    complete: false
  },
  quizzes: [],
  currentQuiz: null
};

function saveState(){
  try{
    localStorage.setItem("bncc-advanced-preferences", JSON.stringify(appState));
  }catch(e){ console.warn("saveState", e); }
}
function loadState(){
  try{
    const saved = JSON.parse(localStorage.getItem("bncc-advanced-preferences"));
    if(saved){
      // assegura estrutura mínima
      appState = Object.assign({}, appState, saved);
      for(const k of ["objectives","activities","games","assessments"]){
        appState.workspace[k] ||= [];
      }
      appState.myActivities ||= [];
      appState.chatbot ||= { messages: [], answers: {}, step: 0, active: false, complete: false };
      appState.quizzes ||= [];
      appState.currentQuiz ||= null;
    }
  }catch(e){ console.warn("loadState", e); }
}
loadState();

// ---------- Dataset ----------
let BNCC = null;
const FALLBACK = {
  "2º ano": {
    "Língua Portuguesa": [
      {"codigo":"EF02LP01","tema":"Leitura","descricao":"Identificar o assunto de textos informativos curtos.","tags":["leitura","compreensão"]},
      {"codigo":"EF02LP02","tema":"Produção de texto","descricao":"Produzir bilhetes simples com finalidade comunicativa.","tags":["escrita","gêneros"]},
      {"codigo":"EF02LP03","tema":"Oralidade","descricao":"Relatar experiências pessoais com sequência temporal.","tags":["oralidade"]}
    ],
    "Matemática": [
      {"codigo":"EF02MA01","tema":"Números","descricao":"Ler, escrever e ordenar números naturais até 1000.","tags":["números","ordenação"]},
      {"codigo":"EF02MA05","tema":"Operações","descricao":"Resolver e criar problemas de adição e subtração.","tags":["problemas","adição","subtração"]},
      {"codigo":"EF02MA12","tema":"Geometria","descricao":"Reconhecer figuras geométricas planas no cotidiano.","tags":["geometria"]}
    ]
  },
  "5º ano": {
    "Língua Portuguesa": [
      {"codigo":"EF05LP01","tema":"Leitura","descricao":"Inferir informações implícitas em textos narrativos.","tags":["inferência","leitura"]},
      {"codigo":"EF05LP06","tema":"Coesão","descricao":"Empregar conectivos para organizar ideias em textos.","tags":["coesão","escrita"]},
      {"codigo":"EF05LP20","tema":"Gramática","descricao":"Reconhecer classes de palavras em textos diversos.","tags":["gramática"]}
    ],
    "Matemática": [
      {"codigo":"EF05MA03","tema":"Multiplicação","descricao":"Resolver problemas com multiplicação e divisão.","tags":["operações"]},
      {"codigo":"EF05MA07","tema":"Frações","descricao":"Representar frações e compará-las em diferentes contextos.","tags":["frações"]},
      {"codigo":"EF05MA24","tema":"Dados","descricao":"Ler e interpretar tabelas e gráficos de colunas.","tags":["dados","gráficos"]}
    ]
  }
};

async function loadBNCC(){
  try{
    const res = await fetch("/bncc.json",{cache:"no-cache"});
    if(!res.ok) throw new Error("fetch bncc.json");
    BNCC = await res.json();
  }catch(e){
    console.warn("Usando dataset interno (fallback)", e);
    BNCC = FALLBACK;
  }
}

// ---------- Util ----------
const esc = s => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

// ---------- Toast Notifications ----------
class ToastManager {
  constructor() {
    this.container = qs('#toast-container');
    this.toasts = new Map();
  }

  show(message, type = 'info', duration = 4000) {
    const id = crypto.randomUUID();
    const toast = this.createToast(id, message, type);
    
    this.container.appendChild(toast);
    this.toasts.set(id, toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Auto remove
    if (duration > 0) {
      setTimeout(() => this.remove(id), duration);
    }

    return id;
  }

  createToast(id, message, type) {
    const toast = $.el('div', { className: `toast toast--${type}` });
    toast.dataset.id = id;

    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    toast.innerHTML = `
      <span class="toast__icon">${icons[type] || icons.info}</span>
      <div class="toast__content">${esc(message)}</div>
      <button class="toast__close" title="Fechar">×</button>
    `;

    // Close button event
    const closeBtn = toast.querySelector('.toast__close');
    $.on(closeBtn, 'click', () => this.remove(id));

    return toast;
  }

  remove(id) {
    const toast = this.toasts.get(id);
    if (!toast) return;

    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
      this.toasts.delete(id);
    }, 300);
  }

  success(message, duration) {
    return this.show(message, 'success', duration);
  }

  error(message, duration) {
    return this.show(message, 'error', duration);
  }

  warning(message, duration) {
    return this.show(message, 'warning', duration);
  }

  info(message, duration) {
    return this.show(message, 'info', duration);
  }
}

// Global toast instance
const toast = new ToastManager();

// ---------- Tooltip System ----------
class TooltipManager {
  constructor() {
    this.tooltips = new Map();
    this.init();
  }

  init() {
    // Auto-initialize tooltips from data-tooltip attributes
    this.initializeExistingTooltips();
    
    // Watch for new elements with tooltips
    const observer = new MutationObserver(() => {
      this.initializeExistingTooltips();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  initializeExistingTooltips() {
    qsa('[data-tooltip]:not([data-tooltip-initialized])').forEach(element => {
      this.addTooltip(element, element.dataset.tooltip, element.dataset.tooltipPosition || 'top');
      element.setAttribute('data-tooltip-initialized', 'true');
    });
  }

  addTooltip(element, text, position = 'top') {
    if (!element || !text) return;

    const container = element.closest('.tooltip-container') || this.wrapElement(element);
    const tooltip = this.createTooltip(text, position);
    
    container.appendChild(tooltip);
    
    // Accessibility
    const tooltipId = 'tooltip-' + crypto.randomUUID().slice(0, 8);
    tooltip.id = tooltipId;
    element.setAttribute('aria-describedby', tooltipId);
    
    this.tooltips.set(element, tooltip);
    
    return tooltip;
  }

  wrapElement(element) {
    const wrapper = $.el('span', { className: 'tooltip-container' });
    element.parentNode.insertBefore(wrapper, element);
    wrapper.appendChild(element);
    return wrapper;
  }

  createTooltip(text, position) {
    const tooltip = $.el('div', { 
      className: `tooltip tooltip--${position}`,
      textContent: text,
      role: 'tooltip'
    });
    return tooltip;
  }

  updateTooltip(element, newText) {
    const tooltip = this.tooltips.get(element);
    if (tooltip) {
      tooltip.textContent = newText;
    }
  }

  removeTooltip(element) {
    const tooltip = this.tooltips.get(element);
    if (tooltip) {
      tooltip.remove();
      element.removeAttribute('aria-describedby');
      this.tooltips.delete(element);
    }
  }
}

// Global tooltip instance
const tooltipManager = new TooltipManager();

// ---------- Loading States Manager ----------
class LoadingManager {
  constructor() {
    this.loadingStates = new Map();
  }

  showButtonLoading(buttonElement, loadingText = null) {
    if (!buttonElement) return;
    
    const originalText = buttonElement.textContent;
    this.loadingStates.set(buttonElement, {
      originalText,
      originalDisabled: buttonElement.disabled
    });
    
    buttonElement.classList.add('loading');
    buttonElement.disabled = true;
    
    if (loadingText) {
      buttonElement.textContent = loadingText;
    }
  }

  hideButtonLoading(buttonElement) {
    if (!buttonElement) return;
    
    const state = this.loadingStates.get(buttonElement);
    if (state) {
      buttonElement.classList.remove('loading');
      buttonElement.textContent = state.originalText;
      buttonElement.disabled = state.originalDisabled;
      this.loadingStates.delete(buttonElement);
    }
  }

  showOverlayLoading(containerElement, message = 'Carregando...') {
    if (!containerElement) return;
    
    const overlay = $.el('div', { className: 'loading-overlay' });
    overlay.innerHTML = `
      <div style="text-align: center;">
        <div class="spinner spinner--large"></div>
        <div style="margin-top: 8px; font-size: 14px;">${message}</div>
      </div>
    `;
    
    containerElement.style.position = 'relative';
    containerElement.appendChild(overlay);
    
    return overlay;
  }

  hideOverlayLoading(containerElement) {
    if (!containerElement) return;
    
    const overlay = containerElement.querySelector('.loading-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  showSkeletonLoading(containerElement, count = 3) {
    if (!containerElement) return;
    
    containerElement.innerHTML = '';
    
    for (let i = 0; i < count; i++) {
      const skeleton = $.el('div', { className: 'skeleton skeleton-card' });
      containerElement.appendChild(skeleton);
    }
  }

  createInlineSpinner(size = 'small') {
    const className = size === 'large' ? 'spinner spinner--large' : 'spinner';
    return $.el('span', { className });
  }
}

// Global loading manager
const loadingManager = new LoadingManager();

// ---------- Theme Manager ----------
class ThemeManager {
  constructor() {
    this.currentTheme = 'auto';
    this.init();
  }

  init() {
    // Load saved theme preference
    const savedTheme = localStorage.getItem('bncc-theme-preference') || 'auto';
    this.setTheme(savedTheme, false);
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.currentTheme === 'auto') {
        this.updateThemeDisplay();
      }
    });
  }

  setTheme(theme, save = true) {
    this.currentTheme = theme;
    
    // Remove existing theme classes
    document.documentElement.classList.remove('theme-light', 'theme-dark', 'theme-auto');
    
    // Apply new theme
    document.documentElement.classList.add(`theme-${theme}`);
    
    // Update button display
    this.updateThemeDisplay();
    
    // Save preference
    if (save) {
      localStorage.setItem('bncc-theme-preference', theme);
      toast.info(`Tema alterado para: ${this.getThemeDisplayName(theme)}`);
    }
  }

  toggleTheme() {
    const themes = ['auto', 'light', 'dark'];
    const currentIndex = themes.indexOf(this.currentTheme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    this.setTheme(nextTheme);
  }

  getThemeDisplayName(theme) {
    const names = {
      'auto': 'Automático',
      'light': 'Claro', 
      'dark': 'Escuro'
    };
    return names[theme] || theme;
  }

  updateThemeDisplay() {
    const button = qs('#toggleTheme');
    if (!button) return;
    
    const icons = {
      'auto': '🌌',
      'light': '☀️',
      'dark': '🌙'
    };
    
    const currentIcon = icons[this.currentTheme] || icons.auto;
    button.innerHTML = `${currentIcon} ${this.getThemeDisplayName(this.currentTheme)}`;
    
    // Update tooltip
    const tooltip = button.closest('.tooltip-container')?.querySelector('.tooltip');
    if (tooltip) {
      tooltip.textContent = `Tema atual: ${this.getThemeDisplayName(this.currentTheme)}. Clique para alternar.`;
    }
  }

  getEffectiveTheme() {
    if (this.currentTheme === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return this.currentTheme;
  }
}

// Global theme manager
const themeManager = new ThemeManager();

// ---------- Back to Top Button ----------
class BackToTopManager {
  constructor() {
    this.button = null;
    this.threshold = 300; // pixels
    this.init();
  }

  init() {
    this.button = qs('#backToTop');
    if (!this.button) return;

    // Show/hide based on scroll position
    window.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
    
    // Click handler
    $.on(this.button, 'click', this.scrollToTop.bind(this));
    
    // Initial check
    this.handleScroll();
  }

  handleScroll() {
    if (!this.button) return;
    
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop > this.threshold) {
      this.button.classList.add('visible');
    } else {
      this.button.classList.remove('visible');
    }
  }

  scrollToTop() {
    // Smooth scroll to top
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
    
    // Accessibility: focus on main content
    setTimeout(() => {
      const mainElement = qs('main') || qs('.container') || document.body;
      if (mainElement && mainElement.focus) {
        mainElement.focus();
      }
    }, 500);
  }
}

// Global back to top manager
const backToTopManager = new BackToTopManager();

// ---------- Favorites & Recent Skills ----------
class FavoritesManager {
  constructor() {
    this.favorites = new Set(JSON.parse(localStorage.getItem('bncc-favorites') || '[]'));
    this.recentlyUsed = JSON.parse(localStorage.getItem('bncc-recent') || '[]');
  }

  toggleFavorite(skillCode) {
    if (this.favorites.has(skillCode)) {
      this.favorites.delete(skillCode);
      toast.info('Removido dos favoritos');
    } else {
      this.favorites.add(skillCode);
      toast.success('Adicionado aos favoritos');
    }
    this.save();
    return this.favorites.has(skillCode);
  }

  addToRecent(skillCode) {
    this.recentlyUsed = this.recentlyUsed.filter(code => code !== skillCode);
    this.recentlyUsed.unshift(skillCode);
    this.recentlyUsed = this.recentlyUsed.slice(0, 10); // Keep only 10 recent
    this.save();
  }

  save() {
    localStorage.setItem('bncc-favorites', JSON.stringify([...this.favorites]));
    localStorage.setItem('bncc-recent', JSON.stringify(this.recentlyUsed));
  }

  isFavorite(skillCode) {
    return this.favorites.has(skillCode);
  }
}

// Global favorites manager
const favoritesManager = new FavoritesManager();

// ---------- Enhanced Search & Onboarding ----------
function showQuickTip(message, element) {
  const existingTip = qs('.quick-tip');
  if (existingTip) existingTip.remove();
  
  const tip = $.el('div', { className: 'quick-tip' });
  tip.innerHTML = `
    <div style="background: var(--brand); color: white; padding: 8px 12px; border-radius: 6px; font-size: 12px; position: relative; z-index: 10001;">
      ${message}
      <button style="background: none; border: none; color: white; float: right; margin-left: 8px;" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;
  
  if (element) {
    element.style.position = 'relative';
    element.appendChild(tip);
  } else {
    document.body.appendChild(tip);
    Object.assign(tip.style, {
      position: 'fixed',
      top: '70px',
      right: '20px',
      zIndex: '10001'
    });
  }
  
  setTimeout(() => tip.remove(), 5000);
}

function checkFirstVisit() {
  const hasVisited = localStorage.getItem('bncc-has-visited');
  if (!hasVisited) {
    localStorage.setItem('bncc-has-visited', 'true');
    setTimeout(() => {
      showQuickTip('Bem-vindo! Use F1 para ver todos os atalhos disponíveis.');
    }, 1000);
  }
}

// ---------- Bulk Selection System ----------
let bulkSelection = new Set();
let lastSelectedSkill = null;
let bulkMode = false;

function toggleBulkMode() {
  bulkMode = !bulkMode;
  document.body.classList.toggle('bulk-mode', bulkMode);
  
  if (!bulkMode) {
    clearBulkSelection();
  }
  
  toast.info(`Modo de seleção ${bulkMode ? 'ativado' : 'desativado'}`);
}

function toggleBulkSelectAll() {
  const items = qsa('.skill, .dropped-item');
  const allSelected = items.every(item => item.classList.contains('bulk-selected'));
  
  if (allSelected) {
    clearBulkSelection();
  } else {
    items.forEach(item => {
      item.classList.add('bulk-selected');
      bulkSelection.add(item.dataset.id || item.dataset.payload);
    });
  }
  
  updateBulkSelectionUI();
}

function clearBulkSelection() {
  bulkSelection.clear();
  qsa('.bulk-selected').forEach(item => {
    item.classList.remove('bulk-selected');
  });
  updateBulkSelectionUI();
}

function updateBulkSelectionUI() {
  const count = bulkSelection.size;
  const toolbar = qs('.toolbar');
  
  // Remove existing bulk toolbar
  const existingBulkToolbar = qs('.bulk-toolbar');
  if (existingBulkToolbar) {
    existingBulkToolbar.remove();
  }
  
  if (count > 0) {
    const bulkToolbar = $.el('div', { className: 'bulk-toolbar' });
    bulkToolbar.innerHTML = `
      <span class="bulk-count">${count} selecionados</span>
      <button class="btn btn--sm btn--danger" id="bulkDelete">Excluir Selecionados</button>
      <button class="btn btn--sm btn--ghost" id="bulkClear">Limpar Seleção</button>
    `;
    
    $.on(bulkToolbar.querySelector('#bulkDelete'), 'click', deleteBulkSelected);
    $.on(bulkToolbar.querySelector('#bulkClear'), 'click', clearBulkSelection);
    
    toolbar.appendChild(bulkToolbar);
  }
}

function deleteBulkSelected() {
  let deletedCount = 0;
  
  bulkSelection.forEach(id => {
    // Try to find and delete from workspace
    for (const section of ['objectives', 'activities', 'games', 'assessments']) {
      const index = appState.workspace[section].findIndex(item => item.id === id);
      if (index !== -1) {
        appState.workspace[section].splice(index, 1);
        deletedCount++;
        break;
      }
    }
    
    // Try to find and delete from activities
    const activityIndex = appState.myActivities.findIndex((_, idx) => idx.toString() === id);
    if (activityIndex !== -1) {
      appState.myActivities.splice(activityIndex, 1);
      deletedCount++;
    }
  });
  
  if (deletedCount > 0) {
    syncWorkspaceDOM();
    renderMyActivities();
    updateStats();
    saveState();
    toast.success(`${deletedCount} itens excluídos`);
  }
  
  clearBulkSelection();
}

// ---------- Keyboard Shortcuts Help ----------
function showKeyboardShortcutsHelp() {
  const helpModal = $.el('div', { className: 'modal', id: 'keyboardHelpModal' });
  helpModal.setAttribute('open', '');
  
  const shortcuts = [
    { key: 'Alt + 1-5', desc: 'Navegar entre abas' },
    { key: 'Ctrl + E', desc: 'Abrir menu de exportação' },
    { key: 'Ctrl + Shift + E', desc: 'Exportar JSON rápido' },
    { key: 'Ctrl + T', desc: 'Alternar modo TEA' },
    { key: 'Ctrl + A', desc: 'Selecionar todos os itens' },
    { key: 'Ctrl + F', desc: 'Focar na busca' },
    { key: 'Delete/Backspace', desc: 'Excluir itens selecionados' },
    { key: 'Escape', desc: 'Limpar seleção/busca' },
    { key: 'Ctrl + 1-4', desc: 'Adicionar última habilidade às seções' },
    { key: 'F1 ou Shift + ?', desc: 'Mostrar esta ajuda' }
  ];
  
  const content = `
    <div class="dialog" style="max-width: 500px;">
      <h3 class="section-title">Atalhos do Teclado</h3>
      <div style="margin: 1rem 0;">
        ${shortcuts.map(s => `
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--muted);">
            <span class="kbd">${s.key}</span>
            <span>${s.desc}</span>
          </div>
        `).join('')}
      </div>
      <div style="text-align: right; margin-top: 1rem;">
        <button class="btn btn--ghost" id="closeHelpModal">Fechar</button>
      </div>
    </div>
  `;
  
  helpModal.innerHTML = content;
  document.body.appendChild(helpModal);
  
  $.on(helpModal.querySelector('#closeHelpModal'), 'click', () => {
    helpModal.remove();
  });
  
  // Close on click outside
  $.on(helpModal, 'click', (e) => {
    if (e.target === helpModal) {
      helpModal.remove();
    }
  });
}

// ---------- Biblioteca ----------
let currentFilters = {
  ano: '',
  componente: '',
  busca: '',
  dificuldade: '',
  duracao: '',
  tea: '',
  sortBy: 'codigo',
  onlyFavorites: false,
  onlyRecent: false
};

let savedSearches = JSON.parse(localStorage.getItem('bncc-saved-searches') || '[]');

function getFilteredSkills(){
  const ano = qs("#anoSel").value;
  const comp = qs("#compSel").value;
  const term = qs("#busca").value.trim().toLowerCase();
  
  // Get advanced filter values
  const difficulty = qs("#difficultyFilter")?.value || '';
  const duration = qs("#durationFilter")?.value || '';
  const tea = qs("#teaFilter")?.value || '';
  const sortBy = qs("#sortBy")?.value || 'codigo';
  
  currentFilters = { ano, componente: comp, busca: term, dificuldade: difficulty, duracao: duration, tea, sortBy };
  
  let arr = (BNCC?.[ano]?.[comp] || []);
  
  // Apply quick filters first
  if (currentFilters.onlyFavorites) {
    arr = arr.filter(it => favoritesManager.isFavorite(it.codigo));
  } else if (currentFilters.onlyRecent) {
    const recentCodes = new Set(favoritesManager.recentlyUsed);
    arr = arr.filter(it => recentCodes.has(it.codigo));
  }
  
  arr = arr.filter(it => {
    // Basic text search - enhanced to include tags
    if(term) {
      const hay = (
        it.codigo + " " + 
        it.tema + " " + 
        it.descricao + " " + 
        (it.tags || []).join(" ") + " " +
        (it.keywords || []).join(" ") // Additional search terms
      ).toLowerCase();
      if (!hay.includes(term)) return false;
    }
    
    // Difficulty filter (simulated based on tema)
    if(difficulty) {
      const estimatedDifficulty = estimateSkillDifficulty(it);
      if (estimatedDifficulty !== difficulty) return false;
    }
    
    // Duration filter (simulated)
    if(duration) {
      const estimatedDuration = estimateSkillDuration(it);
      if (!matchesDurationFilter(estimatedDuration, duration)) return false;
    }
    
    // TEA compatibility filter
    if(tea) {
      const teaCompatible = isTeaCompatible(it);
      if ((tea === 'yes' && !teaCompatible) || (tea === 'no' && teaCompatible)) return false;
    }
    
    return true;
  });
  
  // Apply sorting
  arr.sort((a, b) => {
    switch(sortBy) {
      case 'tema':
        return a.tema.localeCompare(b.tema);
      case 'relevancia':
        return calculateRelevance(b, term) - calculateRelevance(a, term);
      default:
        return a.codigo.localeCompare(b.codigo);
    }
  });
  
  return arr;
}

// Utility functions for filtering
function estimateSkillDifficulty(skill) {
  const complexKeywords = ['resolver', 'analisar', 'comparar', 'interpretar'];
  const mediumKeywords = ['identificar', 'reconhecer', 'aplicar'];
  const easyKeywords = ['ler', 'escrever', 'localizar'];
  
  const desc = skill.descricao.toLowerCase();
  
  if (complexKeywords.some(kw => desc.includes(kw))) return 'dificil';
  if (mediumKeywords.some(kw => desc.includes(kw))) return 'medio';
  if (easyKeywords.some(kw => desc.includes(kw))) return 'facil';
  
  return 'medio'; // default
}

function estimateSkillDuration(skill) {
  const desc = skill.descricao.toLowerCase();
  if (desc.includes('problem') || desc.includes('texto') || desc.includes('interpreta')) return 45;
  if (desc.includes('ler') || desc.includes('escrever')) return 35;
  return 25; // default
}

function matchesDurationFilter(duration, filter) {
  switch(filter) {
    case '0-30': return duration <= 30;
    case '30-60': return duration > 30 && duration <= 60;
    case '60+': return duration > 60;
    default: return true;
  }
}

function isTeaCompatible(skill) {
  // Simple heuristic: some skills are more TEA-friendly
  const teaFriendlyThemes = ['Leitura', 'Números', 'Geometria', 'Oralidade'];
  return teaFriendlyThemes.includes(skill.tema);
}

function calculateRelevance(skill, term) {
  if (!term) return 0;
  
  let score = 0;
  const lowerTerm = term.toLowerCase();
  
  if (skill.codigo.toLowerCase().includes(lowerTerm)) score += 10;
  if (skill.tema.toLowerCase().includes(lowerTerm)) score += 8;
  if (skill.descricao.toLowerCase().includes(lowerTerm)) score += 5;
  
  (skill.tags || []).forEach(tag => {
    if (tag.toLowerCase().includes(lowerTerm)) score += 3;
  });
  
  return score;
}

// Search Management Functions
function saveCurrentSearch() {
  const searchName = prompt('Nome para esta busca:');
  if (!searchName) return;
  
  const search = {
    id: crypto.randomUUID(),
    name: searchName,
    filters: { ...currentFilters },
    created: Date.now()
  };
  
  savedSearches.push(search);
  localStorage.setItem('bncc-saved-searches', JSON.stringify(savedSearches));
  renderSavedSearches();
  toast.success('Busca salva com sucesso!');
}

function applySavedSearch(searchId) {
  const search = savedSearches.find(s => s.id === searchId);
  if (!search) return;
  
  // Apply filters
  qs('#anoSel').value = search.filters.ano;
  qs('#compSel').value = search.filters.componente;
  qs('#busca').value = search.filters.busca;
  
  if (qs('#difficultyFilter')) qs('#difficultyFilter').value = search.filters.dificuldade;
  if (qs('#durationFilter')) qs('#durationFilter').value = search.filters.duracao;
  if (qs('#teaFilter')) qs('#teaFilter').value = search.filters.tea;
  if (qs('#sortBy')) qs('#sortBy').value = search.filters.sortBy;
  
  renderLibrary();
  toast.info(`Busca "${search.name}" aplicada`);
}

function deleteSavedSearch(searchId) {
  savedSearches = savedSearches.filter(s => s.id !== searchId);
  localStorage.setItem('bncc-saved-searches', JSON.stringify(savedSearches));
  renderSavedSearches();
  toast.success('Busca removida');
}

function renderSavedSearches() {
  const container = qs('#savedSearches');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (savedSearches.length === 0) {
    container.innerHTML = '<p style="font-size: 12px; color: var(--muted); margin: 0;">Nenhuma busca salva</p>';
    return;
  }
  
  const wrapper = $.el('div');
  wrapper.innerHTML = '<span style="font-size: 12px; color: var(--muted); margin-right: 8px;">Buscas salvas:</span>';
  
  savedSearches.forEach(search => {
    const tag = $.el('span', { className: 'saved-search' });
    tag.innerHTML = `${esc(search.name)} <span class="remove">×</span>`;
    
    $.on(tag, 'click', (e) => {
      if (e.target.classList.contains('remove')) {
        e.stopPropagation();
        deleteSavedSearch(search.id);
      } else {
        applySavedSearch(search.id);
      }
    });
    
    wrapper.appendChild(tag);
  });
  
  container.appendChild(wrapper);
}

function clearAdvancedFilters() {
  if (qs('#difficultyFilter')) qs('#difficultyFilter').value = '';
  if (qs('#durationFilter')) qs('#durationFilter').value = '';
  if (qs('#teaFilter')) qs('#teaFilter').value = '';
  if (qs('#sortBy')) qs('#sortBy').value = 'codigo';
  
  renderLibrary();
  toast.info('Filtros limpos');
}

// ---------- Template System ----------
const LESSON_TEMPLATES = {
  'matematica-basica': {
    name: 'Matemática Básica',
    description: 'Template para aulas de matemática com foco em operações fundamentais',
    preferences: {
      tema: 'Operações Matemáticas Fundamentais',
      duracao: '50 minutos',
      turma: '5º ano'
    },
    objectives: [
      { titulo: 'EF05MA03 — Multiplicação', descricao: 'Resolver problemas com multiplicação e divisão.' },
      { titulo: 'EF05MA07 — Frações', descricao: 'Representar frações e compará-las em diferentes contextos.' }
    ],
    activities: [
      { titulo: 'Atividade Prática', descricao: 'Resolução de problemas do cotidiano usando operações básicas.' },
      { titulo: 'Exercícios Dirigidos', descricao: 'Lista de exercícios progressivos para fixação.' }
    ],
    games: [
      { titulo: 'Jogo dos Números', descricao: 'Atividade lúdica para praticar cálculos mentais.' }
    ],
    assessments: [
      { titulo: 'Avaliação Diagnóstica', descricao: 'Verificar conhecimentos prévios dos alunos.' }
    ]
  },
  'leitura-compreensao': {
    name: 'Leitura e Compreensão',
    description: 'Template focado no desenvolvimento de habilidades de leitura',
    preferences: {
      tema: 'Desenvolvimento da Leitura e Compreensão',
      duracao: '45 minutos',
      turma: '2º ano'
    },
    objectives: [
      { titulo: 'EF02LP01 — Leitura', descricao: 'Identificar o assunto de textos informativos curtos.' },
      { titulo: 'EF02LP03 — Oralidade', descricao: 'Relatar experiências pessoais com sequência temporal.' }
    ],
    activities: [
      { titulo: 'Leitura Compartilhada', descricao: 'Leitura em grupo com discussão dos pontos principais.' },
      { titulo: 'Questões de Compreensão', descricao: 'Perguntas sobre o texto lido para verificar entendimento.' }
    ],
    games: [
      { titulo: 'Caça-Palavras Temático', descricao: 'Encontrar palavras relacionadas ao texto.' }
    ],
    assessments: [
      { titulo: 'Reconto Oral', descricao: 'Aluno reconta a história com suas palavras.' }
    ]
  },
  'tea-adaptado': {
    name: 'Plano TEA',
    description: 'Template estruturado especialmente para alunos com TEA',
    preferences: {
      tema: 'Aula Adaptada para TEA',
      duracao: '30 minutos (flexível)',
      turma: 'Inclusão'
    },
    objectives: [
      { titulo: 'Objetivo Principal', descricao: 'Desenvolvimento de habilidades com suporte visual e estruturação clara.', tea: 'Usar rotina visual, instruções claras e objetivas.' },
      { titulo: 'Objetivo Secundário', descricao: 'Socialização e comunicação.', tea: 'Atividades estruturadas em pequenos grupos.' }
    ],
    activities: [
      { titulo: 'Atividade Sensorial', descricao: 'Exploração tátil e visual do conteúdo.', tea: 'Material concreto e manipulável.' },
      { titulo: 'Sequência Lógica', descricao: 'Atividades em etapas bem definidas.', tea: 'Avisos de transição, tempo flexível.' }
    ],
    games: [
      { titulo: 'Jogo Estruturado', descricao: 'Atividade com regras claras e previsíveis.', tea: 'Apoio visual constante, feedback positivo.' }
    ],
    assessments: [
      { titulo: 'Observação Contínua', descricao: 'Acompanhamento individualizado do progresso.', tea: 'Registro diário, adapt. conforme necessidade.' }
    ]
  },
  'atividade-ludica': {
    name: 'Atividade Lúdica',
    description: 'Template focado em aprendizado através de jogos e brincadeiras',
    preferences: {
      tema: 'Aprender Brincando',
      duracao: '40 minutos',
      turma: 'Multisérie'
    },
    objectives: [
      { titulo: 'Aprendizado Lúdico', descricao: 'Desenvolver habilidades através de jogos educativos.' }
    ],
    activities: [
      { titulo: 'Aquecimento Lúdico', descricao: 'Brincadeira inicial para engajar os alunos.' }
    ],
    games: [
      { titulo: 'Jogo Principal', descricao: 'Atividade central com objetivos pedagógicos claros.' },
      { titulo: 'Jogo de Fixação', descricao: 'Reforço do conteúdo de forma divertida.' },
      { titulo: 'Desafio Final', descricao: 'Competição saudável para consolidar o aprendizado.' }
    ],
    assessments: [
      { titulo: 'Autoavaliação Lúdica', descricao: 'Reflexão sobre o que aprenderam durante as atividades.' }
    ]
  },
  'avaliacao-formativa': {
    name: 'Avaliação Formativa',
    description: 'Template focado no acompanhamento contínuo do aprendizado',
    preferences: {
      tema: 'Acompanhamento e Avaliação',
      duracao: '45 minutos',
      turma: 'Personalizável'
    },
    objectives: [
      { titulo: 'Diagnóstico', descricao: 'Identificar nível atual de conhecimento dos alunos.' }
    ],
    activities: [
      { titulo: 'Revisão Participativa', descricao: 'Recapitulação dos conteúdos com participação ativa.' }
    ],
    games: [],
    assessments: [
      { titulo: 'Avaliação Diagnóstica', descricao: 'Verificação inicial dos conhecimentos.' },
      { titulo: 'Acompanhamento Individual', descricao: 'Observação personalizada de cada aluno.' },
      { titulo: 'Feedback Construtivo', descricao: 'Orientações para melhoria contínua.' },
      { titulo: 'Autoavaliação', descricao: 'Reflexão do aluno sobre seu próprio aprendizado.' }
    ]
  }
};

let selectedTemplate = null;

function applyTemplate(templateId) {
  const template = LESSON_TEMPLATES[templateId];
  if (!template) {
    toast.error('Template não encontrado');
    return;
  }
  
  // Clear current workspace
  appState.workspace = { objectives: [], activities: [], games: [], assessments: [] };
  
  // Apply template preferences
  if (template.preferences) {
    qs('#prefTheme').value = template.preferences.tema || '';
    qs('#prefClass').value = template.preferences.turma || '';
    qs('#prefTime').value = template.preferences.duracao || '';
    
    // Update user profile
    appState.userProfile.prefTheme = template.preferences.tema;
    appState.userProfile.prefClass = template.preferences.turma;
    appState.userProfile.prefTime = template.preferences.duracao;
  }
  
  // Add template items to workspace
  ['objectives', 'activities', 'games', 'assessments'].forEach(section => {
    if (template[section]) {
      template[section].forEach(item => {
        const workspaceItem = {
          id: crypto.randomUUID(),
          codigo: 'TEMPLATE',
          titulo: item.titulo,
          descricao: item.descricao,
          tea: item.tea || null,
          media: []
        };
        appState.workspace[section].push(workspaceItem);
      });
    }
  });
  
  // Update UI
  syncWorkspaceDOM();
  updateStats();
  saveState();
  
  // Mark selected template
  qsa('.template-card').forEach(card => card.classList.remove('active'));
  qs(`[data-template="${templateId}"]`)?.classList.add('active');
  selectedTemplate = templateId;
  
  toast.success(`Template "${template.name}" aplicado com sucesso!`);
}

function clearWorkspace() {
  appState.workspace = { objectives: [], activities: [], games: [], assessments: [] };
  qs('#prefTheme').value = '';
  qs('#prefClass').value = '';
  qs('#prefTime').value = '';
  
  syncWorkspaceDOM();
  updateStats();
  saveState();
  
  qsa('.template-card').forEach(card => card.classList.remove('active'));
  selectedTemplate = null;
  
  toast.info('Workspace limpo - pronto para criar do zero');
}

function resetWorkspaceWithConfirmation() {
  const totalItems = Object.values(appState.workspace).reduce((sum, arr) => sum + arr.length, 0);
  
  if (totalItems === 0) {
    toast.info('O workspace já está vazio.');
    return;
  }
  
  const confirmModal = $.el('div', { className: 'modal', id: 'confirmResetModal' });
  confirmModal.setAttribute('open', '');
  
  const content = `
    <div class="dialog" style="max-width: 400px;">
      <h3 class="section-title">⚠️ Confirmar Limpeza</h3>
      <p>Tem certeza que deseja limpar todo o workspace?</p>
      <p><strong>${totalItems} itens</strong> serão removidos permanentemente.</p>
      <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 1.5rem;">
        <button class="btn btn--ghost" id="cancelReset">Cancelar</button>
        <button class="btn btn--danger" id="confirmReset">🗑️ Confirmar Limpeza</button>
      </div>
    </div>
  `;
  
  confirmModal.innerHTML = content;
  document.body.appendChild(confirmModal);
  
  $.on(confirmModal.querySelector('#cancelReset'), 'click', () => {
    confirmModal.remove();
  });
  
  $.on(confirmModal.querySelector('#confirmReset'), 'click', () => {
    clearWorkspace();
    confirmModal.remove();
    toast.success(`Workspace limpo! ${totalItems} itens removidos.`);
  });
  
  // Close on click outside
  $.on(confirmModal, 'click', (e) => {
    if (e.target === confirmModal) {
      confirmModal.remove();
    }
  });
  
  // Focus on confirm button for accessibility
  setTimeout(() => {
    confirmModal.querySelector('#confirmReset').focus();
  }, 100);
}

function makeSkillCard(skill){
  const card = $.el("div", {className:"skill", draggable:true});
  card.dataset.payload = JSON.stringify({ type:"skill", skill });
  card.dataset.id = skill.codigo;
  
  card.addEventListener("dragstart", e=>{
    e.dataTransfer?.setData("text/plain", card.dataset.payload);
  });

  const h = $.el("div", { style: 'display: flex; justify-content: space-between; align-items: center;' });
  const titleSpan = $.el('span');
  titleSpan.innerHTML = `<strong>${esc(skill.codigo)}</strong> — ${esc(skill.tema)}`;
  
  // Favorite button
  const favoriteBtn = $.el('button', { 
    className: 'btn--favorite',
    style: 'background: none; border: none; font-size: 16px; cursor: pointer; padding: 4px;',
    title: 'Adicionar/remover dos favoritos'
  });
  favoriteBtn.textContent = favoritesManager.isFavorite(skill.codigo) ? '❤️' : '🤍';
  
  $.on(favoriteBtn, 'click', (e) => {
    e.stopPropagation();
    const isFav = favoritesManager.toggleFavorite(skill.codigo);
    favoriteBtn.textContent = isFav ? '❤️' : '🤍';
  });
  
  h.append(titleSpan, favoriteBtn);
  
  const p = $.el("p"); p.textContent = skill.descricao;
  const meta = $.el("div", {className:"meta"});
  (skill.tags||[]).forEach(t => {
    const chip = $.el("span",{className:"chip"}); chip.textContent = t;
    meta.appendChild(chip);
  });

  // Click handler for selection and detail modal
  card.addEventListener("click", (e) => {
    lastSelectedSkill = skill;
    favoritesManager.addToRecent(skill.codigo);
    
    // Bulk selection with Ctrl/Cmd
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const isSelected = card.classList.contains('bulk-selected');
      
      if (isSelected) {
        card.classList.remove('bulk-selected');
        bulkSelection.delete(card.dataset.id);
      } else {
        card.classList.add('bulk-selected');
        bulkSelection.add(card.dataset.id);
      }
      
      updateBulkSelectionUI();
    } else {
      openSkillDetailModal(skill);
    }
  });

  card.append(h,p,meta);
  return card;
}

function renderLibrary(){
  const list = qs("#libraryList");
  list.setAttribute("aria-busy","true");
  list.innerHTML = "";
  const arr = getFilteredSkills();
  if(arr.length===0){
    list.innerHTML = `<div class="card">Nenhuma habilidade encontrada. Tente outro termo.</div>`;
  }else{
    arr.forEach(skill=> list.appendChild(makeSkillCard(skill)));
  }
  list.setAttribute("aria-busy","false");
}

// ---------- Workspace ----------
function addSkillToSection(skill, section){
  const item = {
    id: crypto.randomUUID(),
    codigo: skill.codigo,
    titulo: `${skill.codigo} — ${skill.tema}`,
    descricao: skill.descricao,
    tea: appState.teaModeActive ? makeTeaTip(skill) : null,
    media: [] // Prepare for future media integration
  };
  appState.workspace[section].push(item);
  syncWorkspaceDOM();
  updateStats();
  saveState();
}

function removeItem(section, id){
  appState.workspace[section] = appState.workspace[section].filter(x=>x.id!==id);
  syncWorkspaceDOM();
  updateStats();
  saveState();
}

function makeTeaTip(skill){
  // Regra simples apenas como exemplo
  const map = {
    "Leitura":"Use organizadores visuais, leitura guiada e pictogramas.",
    "Operações":"Materiais concretos e sequenciação passo a passo.",
    "Frações":"Modelos visuais e manipulação com círculos fracionários."
  };
  return map[skill.tema] || "Ajustar linguagem, passos curtos, reforço visual e pausa ativa.";
}

function zoneNode(section){ return qs(`#${section}-zone .zone-list`); }

function droppedItemNode(section, item){
  const node = $.el("div",{className:"dropped-item", draggable:false});
  node.dataset.id = item.id;
  
  const title = $.el("div"); 
  title.innerHTML = `<strong>${esc(item.titulo)}</strong>${item.tea?` <span class="badge">TEA</span>`:""}`;
  const desc = $.el("div"); 
  desc.textContent = item.descricao;
  const left = $.el("div"); 
  left.append(title, desc);
  
  const actions = $.el("div",{className:"actions"});
  const del = $.el("button",{className:"btn btn--danger btn--sm", title:"Remover"}); 
  del.textContent="Remover";
  del.addEventListener("click",()=> removeItem(section, item.id));
  actions.appendChild(del);
  
  // Add bulk selection support
  node.addEventListener('click', (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const isSelected = node.classList.contains('bulk-selected');
      
      if (isSelected) {
        node.classList.remove('bulk-selected');
        bulkSelection.delete(item.id);
      } else {
        node.classList.add('bulk-selected');
        bulkSelection.add(item.id);
      }
      
      updateBulkSelectionUI();
    }
  });
  
  node.append(left, actions);
  return node;
}


function enableDnD(){
  // Zonas aceitam drop de cards da biblioteca
  qsa(".dropzone").forEach(zone=>{
    zone.addEventListener("dragover", e=>{
      if(e.dataTransfer) e.preventDefault();
    });
    zone.addEventListener("drop", e=>{
      e.preventDefault();
      try{
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
        if(data?.type==="skill"){
          const section = zone.dataset.section;
          addSkillToSection(data.skill, section);
        }
      }catch(_){}
    });
  });
}

function enableSortable(){
  ["objectives","activities","games","assessments"].forEach(section=>{
    const list = zoneNode(section);
    if(!list) return;
    Sortable.create(list, {
      animation: 150,
      onEnd: ()=>{
        // Reconciliar ordem pelo DOM
        const newArr = [];
        list.querySelectorAll(".dropped-item").forEach(node=>{
          // reconstruir a partir do texto; guardamos id em dataset para ser robusto
          // vamos guardar dataset-id ao criar
        });
        // Alternativa: reconstruir diretamente da posição anterior
        // Mais simples: nada a fazer, pois Sortable só reordena DOM; re-sincronizar lendo appState e re-render é caro.
        // Implementação robusta: inserir data-id e reconstruir:
        const ids = [...list.querySelectorAll(".dropped-item")].map(n=>n.dataset.id);
        const byId = Object.fromEntries(appState.workspace[section].map(i=>[i.id,i]));
        ids.forEach(id => byId[id] && newArr.push(byId[id]));
        appState.workspace[section] = newArr;
        saveState();
      }
    });
  });
}

function syncWorkspaceDOM(){
  ["objectives","activities","games","assessments"].forEach(section=>{
    const list = zoneNode(section);
    list.innerHTML = "";
    appState.workspace[section].forEach(it=>{
      const node = droppedItemNode(section, it);
      node.dataset.id = it.id;
      list.appendChild(node);
    });
  });
}

// ---------- Minhas Atividades ----------
function renderMyActivities(){
  const wrap = qs("#myActivitiesList");
  wrap.innerHTML = "";
  if(appState.myActivities.length===0){
    wrap.innerHTML = `<div class="card">Nenhuma atividade criada.</div>`;
    return;
  }
  appState.myActivities.forEach((a, idx)=>{
    const card = $.el("div",{className:"skill"});
    const h = $.el("div"); h.innerHTML = `<strong>${esc(a.title)}</strong> ${a.tags?`<span class="badge">${esc(a.tags)}</span>`:""}`;
    const p = $.el("p"); p.textContent = a.description || "";
    const actions = $.el("div", {style:"display:flex;gap:6px"});
    const del = $.el("button",{className:"btn btn--danger btn--sm"}); del.textContent="Excluir";
    del.addEventListener("click",()=>{
      appState.myActivities.splice(idx,1);
      renderMyActivities(); saveState();
    });
    const add = $.el("button",{className:"btn btn--sm"}); add.textContent="+ Enviar ao Workspace";
    add.addEventListener("click",()=>{
      const skill = { codigo:"ATV", tema:a.title, descricao:a.description };
      addSkillToSection(skill, "activities");
    });
    actions.append(del, add);
    card.append(h,p,actions);
    wrap.appendChild(card);
  });
}

// ---------- Chatbot ----------
const STORY_PROMPT = [
  { key: "hero", q: "Olá! Vamos criar uma história juntos. Qual é o nome do nosso herói ou heroína?" },
  { key: "place", q: "Legal! Onde a aventura de {hero} acontece?" },
  { key: "friend", q: "Todo herói precisa de um amigo. Quem acompanha {hero} nesta jornada?" },
  { key: "challenge", q: "Qual é o maior desafio que {hero} e {friend} encontram?" },
  { key: "solution", q: "E como eles, com muita criatividade, superam o desafio '{challenge}'?" },
];

function renderChatMessages() {
  const container = qs("#chatMessages");
  container.innerHTML = "";
  appState.chatbot.messages.forEach(msg => {
    const msgEl = $.el("div", { className: `chat-message ${msg.sender}` });
    msgEl.textContent = msg.text;
    container.appendChild(msgEl);
  });
  container.scrollTop = container.scrollHeight;
}

function addChatMessage(sender, text) {
  appState.chatbot.messages.push({ sender, text });
  renderChatMessages();
}

function generateFinalStory() {
  const { answers } = appState.chatbot;
  return `Era uma vez, um(a) herói(na) chamado(a) ${answers.hero}, que vivia em ${answers.place}. Um dia, ${answers.hero} e seu fiel amigo ${answers.friend} se depararam com um grande desafio: ${answers.challenge}. Com coragem e inteligência, eles encontraram uma solução: ${answers.solution}. E assim, eles salvaram o dia!`;
}

function askNextQuestion() {
  const { step, answers } = appState.chatbot;
  if (step < STORY_PROMPT.length) {
    const nextQ = STORY_PROMPT[step];
    let questionText = nextQ.q;
    // Replace placeholders
    for(const key in answers) {
      questionText = questionText.replace(`{${key}}`, answers[key]);
    }
    addChatMessage("bot", questionText);
    appState.chatbot.step++;
  } else {
    // Story is complete
    appState.chatbot.complete = true;
    const finalStory = generateFinalStory();
    addChatMessage("bot", "Ótimo! Aqui está a sua história:");
    addChatMessage("bot", finalStory);

    const actions = $.el("div", { style: "display: flex; gap: 10px; margin-top: 10px;" });
    const copyBtn = $.el("button", { className: "btn btn--sm" });
    copyBtn.textContent = "Copiar História";
    $.on(copyBtn, "click", () => {
      navigator.clipboard.writeText(finalStory)
        .then(() => toast.success("História copiada!"))
        .catch(err => {
          console.warn("Falha ao copiar", err);
          toast.error("Falha ao copiar. Tente novamente.");
        });
    });

    const resetBtn = $.el("button", { className: "btn btn--sm btn--ghost" });
    resetBtn.textContent = "Começar de Novo";
    $.on(resetBtn, "click", startChat);

    actions.append(copyBtn, resetBtn);
    qs("#chatMessages").appendChild(actions);
  }
  saveState();
}

function startChat() {
  appState.chatbot = {
    messages: [],
    answers: {},
    step: 0,
    active: true,
    complete: false
  };
  askNextQuestion();
}

function handleChatMessage() {
  const input = qs("#chatInput");
  const text = input.value.trim();
  if (!text || appState.chatbot.complete) return;

  addChatMessage("user", text);

  const currentStep = appState.chatbot.step - 1;
  const currentQ = STORY_PROMPT[currentStep];
  appState.chatbot.answers[currentQ.key] = text;

  input.value = "";
  setTimeout(askNextQuestion, 500);
}

// ---------- Quiz Creator ----------

function createQuestionElement(question, index) {
  const questionBlock = $.el("div", { className: "question-block" });
  questionBlock.dataset.index = index;

  const questionInput = $.el("input", {
    type: "text",
    className: "input focus-ring",
    placeholder: "Digite a pergunta...",
    value: question.text
  });
  $.on(questionInput, "change", () => {
    appState.currentQuiz.questions[index].text = questionInput.value;
  });

  const answersContainer = $.el("div", { className: "answers-container" });
  question.answers.forEach((answer, answerIndex) => {
    const group = $.el("div", { className: "answer-input-group" });
    const radio = $.el("input", {
      type: "radio",
      name: `correct-answer-${index}`,
      checked: question.correctAnswerIndex === answerIndex
    });
    $.on(radio, "change", () => {
      appState.currentQuiz.questions[index].correctAnswerIndex = answerIndex;
    });

    const answerInput = $.el("input", {
      type: "text",
      className: "input focus-ring",
      placeholder: `Resposta ${answerIndex + 1}`,
      value: answer
    });
    $.on(answerInput, "change", () => {
      appState.currentQuiz.questions[index].answers[answerIndex] = answerInput.value;
    });

    group.append(radio, answerInput);
    answersContainer.appendChild(group);
  });

  const removeBtn = $.el("button", { className: "btn btn--danger btn--sm", style: "margin-top: 1rem;" });
  removeBtn.textContent = "Remover Pergunta";
  $.on(removeBtn, "click", () => {
    appState.currentQuiz.questions.splice(index, 1);
    renderQuizEditor();
  });

  questionBlock.append(questionInput, answersContainer, removeBtn);
  return questionBlock;
}

function renderQuizEditor() {
  if (!appState.currentQuiz) return;
  qs("#quizTitle").value = appState.currentQuiz.title;
  const container = qs("#questions-container");
  container.innerHTML = "";
  appState.currentQuiz.questions.forEach((q, i) => {
    container.appendChild(createQuestionElement(q, i));
  });
}

function addQuestion() {
  if (!appState.currentQuiz) return;
  appState.currentQuiz.questions.push({
    text: "",
    answers: ["", "", "", ""],
    correctAnswerIndex: 0,
    media: [] // Prepare for future media integration
  });
  renderQuizEditor();
}

function saveQuiz() {
  const { currentQuiz } = appState;
  if (!currentQuiz || !currentQuiz.title.trim()) {
    toast.warning("Por favor, dê um título ao quiz.");
    return;
  }
  if (currentQuiz.questions.length === 0) {
    toast.warning("Adicione pelo menos uma pergunta.");
    return;
  }
  // Basic validation
  for (const q of currentQuiz.questions) {
    if (!q.text.trim() || q.answers.some(a => !a.trim())) {
      toast.error("Por favor, preencha todos os campos de todas as perguntas e respostas.");
      return;
    }
  }

  appState.quizzes.push(JSON.parse(JSON.stringify(currentQuiz)));
  saveState();
  renderQuizzesList();
  toast.success("Quiz salvo com sucesso!");
  startNewQuiz();
}

function renderQuizzesList() {
  const container = qs("#quiz-list");
  container.innerHTML = "";

  if (appState.quizzes.length === 0) {
    container.innerHTML = `<p>Nenhum quiz salvo ainda.</p>`;
    return;
  }

  appState.quizzes.forEach(quiz => {
    const item = $.el("div", { className: "dropped-item" }); // Reusing styles
    const title = $.el("span");
    title.textContent = quiz.title;

    const actions = $.el("div", { className: "actions" });
    const playBtn = $.el("button", { className: "btn btn--sm" });
    playBtn.textContent = "▶️ Jogar";
    $.on(playBtn, "click", () => launchQuiz(quiz.id));

    const delBtn = $.el("button", { className: "btn btn--danger btn--sm" });
    delBtn.textContent = "Excluir";
    $.on(delBtn, "click", () => {
      if (confirm(`Tem certeza que deseja excluir o quiz "${quiz.title}"?`)) {
        appState.quizzes = appState.quizzes.filter(q => q.id !== quiz.id);
        saveState();
        renderQuizzesList();
      }
    });

    actions.append(playBtn, delBtn);
    item.append(title, actions);
    container.appendChild(item);
  });
}

function startNewQuiz() {
  appState.currentQuiz = {
    id: crypto.randomUUID(),
    title: "",
    questions: []
  };
  renderQuizEditor();
}

// ---------- Quiz Player ----------
let playerState = null;

function renderPlayerQuestion() {
  const { quiz, currentQuestionIndex } = playerState;
  const question = quiz.questions[currentQuestionIndex];

  qs("#playerQuizTitle").textContent = quiz.title;
  qs("#playerQuestionText").textContent = question.text;

  const answersContainer = qs("#playerAnswersContainer");
  answersContainer.innerHTML = "";

  question.answers.forEach((answer, index) => {
    const answerBtn = $.el("button", { className: "btn answer-btn" });
    answerBtn.textContent = answer;
    $.on(answerBtn, "click", () => handleAnswerClick(index));
    answersContainer.appendChild(answerBtn);
  });

  qs("#playerNextBtn").hidden = true;
}

function handleAnswerClick(selectedIndex) {
  const { quiz, currentQuestionIndex } = playerState;
  const question = quiz.questions[currentQuestionIndex];
  const correct = selectedIndex === question.correctAnswerIndex;

  if (correct) {
    playerState.score++;
  }

  const answerButtons = qsa("#playerAnswersContainer .answer-btn");
  answerButtons.forEach((btn, index) => {
    btn.disabled = true;
    if (index === question.correctAnswerIndex) {
      btn.classList.add("correct");
    } else if (index === selectedIndex) {
      btn.classList.add("incorrect");
    }
  });

  qs("#playerNextBtn").hidden = false;
}

function nextQuestion() {
  playerState.currentQuestionIndex++;
  if (playerState.currentQuestionIndex < playerState.quiz.questions.length) {
    renderPlayerQuestion();
  } else {
    showPlayerSummary();
  }
}

function showPlayerSummary() {
  qs("#playerContent").hidden = true;
  qs("#playerSummaryContainer").hidden = false;
  qs("#playerFinalScore").textContent = `${playerState.score} / ${playerState.quiz.questions.length}`;
}

function launchQuiz(quizId) {
  const quizToPlay = appState.quizzes.find(q => q.id === quizId);
  if (!quizToPlay) return;

  playerState = {
    quiz: quizToPlay,
    currentQuestionIndex: 0,
    score: 0
  };

  qs("#playerContent").hidden = false;
  qs("#playerSummaryContainer").hidden = true;
  qs("#quizPlayerModal").setAttribute("open", "");
  renderPlayerQuestion();
}

function closeQuizPlayer() {
  qs("#quizPlayerModal").removeAttribute("open");
  playerState = null;
}

// ---------- Skill Detail Modal ----------
function openSkillDetailModal(skill) {
  qs("#skillDetailTitle").textContent = `${skill.codigo} — ${skill.tema}`;
  qs("#skillDetailDescription").textContent = skill.descricao;

  const actionsContainer = qs("#skillDetailActions");
  actionsContainer.innerHTML = ""; // Clear previous actions

  // Add to workspace buttons
  const workspaceActions = [
    ["🎯 Adicionar como Objetivo", "objectives"],
    ["🛠️ Adicionar como Atividade", "activities"],
    ["🎲 Adicionar como Jogo", "games"],
    ["📊 Adicionar como Avaliação", "assessments"]
  ];
  workspaceActions.forEach(([label, sect]) => {
    const btn = $.el("button", { className: "btn btn--sm" });
    btn.textContent = label;
    $.on(btn, "click", () => {
      addSkillToSection(skill, sect);
      closeSkillDetailModal();
      // Optional: show a success toast
    });
    actionsContainer.appendChild(btn);
  });

  // AI Suggestion button
  const aiBtn = $.el("button", { className: "btn btn--sm btn--ghost" });
  aiBtn.innerHTML = `✨ Sugerir Atividades com IA`;
  
  // Check API status before showing button
  checkApiStatus().then(isAvailable => {
    if (!isAvailable) {
      aiBtn.innerHTML = `✨ IA (Offline)`;
      aiBtn.disabled = true;
      aiBtn.title = "Assistente de IA indisponível no momento";
    }
  });
  
  $.on(aiBtn, "click", () => {
    closeSkillDetailModal(); // Close this modal before opening the other
    handleAiSuggestion(skill);
  });
  actionsContainer.appendChild(aiBtn);

  qs("#skillDetailModal").setAttribute("open", "");
}

function closeSkillDetailModal() {
  qs("#skillDetailModal").removeAttribute("open");
}

// ---------- AI Assistant ----------
function renderAiSuggestions(suggestions, container = null) {
  const targetContainer = container || qs("#aiSuggestionsList");
  targetContainer.innerHTML = "";
  
  if (!suggestions || suggestions.length === 0) {
    targetContainer.innerHTML = `<p>Não foi possível gerar sugestões no momento. Tente novamente.</p>`;
    return;
  }

  const list = $.el("ul", { style: "padding-left: 20px;" });
  suggestions.forEach(sug => {
    const item = $.el("li", { style: "margin-bottom: 1rem;" });
    const title = $.el("strong");
    title.textContent = sug.title;
    const desc = $.el("p", { style: "margin: 0;" });
    desc.textContent = sug.description;
    item.append(title, desc);
    list.appendChild(item);
  });
  targetContainer.appendChild(list);
}

// Fallback suggestions system
function generateFallbackSuggestions(skill) {
  const baseActivities = {
    "Leitura": [
      { title: "Leitura Compartilhada", description: "Ler o texto em voz alta e discutir o conteúdo com os alunos, promovendo compreensão e interação." },
      { title: "Questões de Compreensão", description: "Criar perguntas sobre o texto para verificar o entendimento e estimular o pensamento crítico." },
      { title: "Teatro de Leitura", description: "Dramatizar partes do texto para tornar a leitura mais envolvente e memorial." }
    ],
    "Escrita": [
      { title: "Produção Textual Guiada", description: "Orientar os alunos na criação de textos com estrutura e propósito definidos." },
      { title: "Revisão Colaborativa", description: "Trabalhar em duplas para revisar e melhorar os textos produzidos." },
      { title: "Diário de Aprendizagem", description: "Manter um registro diário das descobertas e aprendizados." }
    ],
    "Números": [
      { title: "Jogos Numéricos", description: "Utilizar jogos e brincadeiras para trabalhar conceitos matemáticos de forma lúdica." },
      { title: "Material Concreto", description: "Usar objetos manipuláveis para visualizar e compreender conceitos abstratos." },
      { title: "Problemas do Cotidiano", description: "Criar situações problemáticas baseadas na realidade dos alunos." }
    ],
    "Operações": [
      { title: "Cálculo Mental", description: "Desenvolver estratégias de cálculo mental através de exercícios progressivos." },
      { title: "Algoritmos Alternativos", description: "Apresentar diferentes formas de resolver operações matemáticas." },
      { title: "Jogos de Estratégia", description: "Usar jogos que envolvem raciocínio lógico e cálculos." }
    ],
    "Geometria": [
      { title: "Exploração do Espaço", description: "Atividades de movimentação e observação do ambiente para compreender formas geométricas." },
      { title: "Construção com Formas", description: "Usar blocos e materiais para construir e identificar formas geométricas." },
      { title: "Arte Geométrica", description: "Criar desenhos e pinturas utilizando formas geométricas." }
    ]
  };
  
  // Try to match skill theme to suggestions
  const theme = skill.tema || "";
  let suggestions = [];
  
  for (const key in baseActivities) {
    if (theme.toLowerCase().includes(key.toLowerCase())) {
      suggestions = baseActivities[key];
      break;
    }
  }
  
  // Fallback to generic educational activities
  if (suggestions.length === 0) {
    suggestions = [
      { title: "Atividade Prática", description: "Desenvolver uma atividade hands-on relacionada ao tema da habilidade." },
      { title: "Discussão em Grupo", description: "Promover debate e troca de ideias sobre o conteúdo abordado." },
      { title: "Projeto Colaborativo", description: "Criar um projeto em equipe que aplique os conceitos aprendidos." }
    ];
  }
  
  return suggestions;
}

// API Status Check
async function checkApiStatus() {
  try {
    const response = await fetch('/api/suggest-activities', {
      method: 'HEAD', // Just check if endpoint exists
      cache: 'no-cache'
    });
    return response.status !== 404;
  } catch (error) {
    console.warn('API check failed:', error);
    return false;
  }
}

async function handleAiSuggestion(skill) {
  const modal = qs("#aiSuggestionModal");
  const descEl = qs("#aiSkillDescription");
  const listEl = qs("#aiSuggestionsList");

  descEl.textContent = skill.descricao;
  
  // Show loading state with skeleton
  listEl.innerHTML = `
    <div style="display: flex; align-items: center; margin-bottom: 16px;">
      <div class="spinner"></div>
      <span>Gerando sugestões personalizadas...</span>
    </div>
    <div class="skeleton skeleton-text" style="width: 100%; margin: 8px 0;"></div>
    <div class="skeleton skeleton-text" style="width: 85%; margin: 8px 0;"></div>
    <div class="skeleton skeleton-text" style="width: 90%; margin: 8px 0;"></div>
  `;
  
  modal.setAttribute("open", "");

  try {
    const response = await fetch("/api/suggest-activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skillDescription: skill.descricao }),
    });

    if (!response.ok) {
      // Log detailed error for debugging
      console.error(`API Error: ${response.status} - ${response.statusText}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    renderAiSuggestions(data.suggestions);

  } catch (error) {
    console.error("Failed to get AI suggestions:", error);
    
    // Show fallback suggestions based on skill theme
    const fallbackSuggestions = generateFallbackSuggestions(skill);
    
    listEl.innerHTML = `
      <div style="background: var(--warning); color: white; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
        <div style="font-size: 18px; margin-bottom: 8px;">⚠️ IA Indisponível</div>
        <p style="margin: 0; font-size: 14px;">Não foi possível conectar com o assistente de IA. Aqui estão algumas sugestões baseadas na habilidade:</p>
      </div>
      <div id="fallbackSuggestions"></div>
      <div style="text-align: center; margin-top: 16px;">
        <button class="btn btn--sm" onclick="handleAiSuggestion(${JSON.stringify(skill).replace(/"/g, '&quot;')})">🔄 Tentar Novamente</button>
      </div>
    `;
    
    // Render fallback suggestions
    const fallbackContainer = listEl.querySelector('#fallbackSuggestions');
    renderAiSuggestions(fallbackSuggestions, fallbackContainer);
  }
}

function closeAiModal() {
  qs("#aiSuggestionModal").removeAttribute("open");
}

// ---------- Exportações ----------
async function exportWorkspaceToPDF(){
  const exportBtn = qs('#openExport');
  
  try {
    loadingManager.showButtonLoading(exportBtn, '⬇️ Exportando...');
    
    const { jsPDF } = window.jspdf || {};
    if(!jsPDF){ 
      toast.error("jsPDF não carregou. Verifique a conexão."); 
      return; 
    }

    // Create a temporary, off-screen container for the PDF content
    const printContainer = $.el("div");
    Object.assign(printContainer.style, {
      position: "absolute",
      left: "-9999px",
      top: "auto",
      width: "800px",
      padding: "20px",
      background: "white",
      color: "black",
      fontFamily: `Inter, system-ui, sans-serif`
    });

    // Build the custom document header
    const subject = qs("#compSel").value;
    const allSkills = Object.values(appState.workspace).flat();
    const uniqueSkillCodes = [...new Set(allSkills.map(item => item.codigo))].filter(code => code !== 'ATV');

    const headerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="margin: 0;">ESCOLA MUNICIPAL SIMONE DOS SANTOS - TAUBATÉ</h2>
        <p style="margin: 0;">Professora: MAELLY</p>
      </div>
      <div style="margin-bottom: 20px;">
        <p><strong>Componente Curricular:</strong> ${esc(subject)}</p>
        <p><strong>Habilidades da BNCC:</strong> ${uniqueSkillCodes.length > 0 ? esc(uniqueSkillCodes.join(', ')) : 'Nenhuma'}</p>
      </div>
      <hr style="border: 0; border-top: 1px solid #ccc; margin-bottom: 20px;">
    `;

    // Clone the workspace content
    const workspaceContent = qs(".canvas").cloneNode(true);
    // Remove unwanted elements from the clone, like stats and preferences
    workspaceContent.querySelector('.grid.grid-2')?.remove();

    printContainer.innerHTML = headerHTML;
    printContainer.appendChild(workspaceContent);

    document.body.appendChild(printContainer);

    window.scrollTo(0,0);
    const canvas = await html2canvas(printContainer, {scale:2, useCORS:true});

    // Clean up the temporary element
    document.body.removeChild(printContainer);

    const img = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p","mm","a4");
    const pageW = 210, pageH = 297;
    const margin = 8;
    const imgW = pageW - margin*2;
    const imgH = canvas.height * imgW / canvas.width;

    if(imgH <= pageH - margin*2){
      pdf.addImage(img, "PNG", margin, margin, imgW, imgH);
    } else {
      let sY = 0;
      const pagePxH = (pageH - margin*2) * canvas.width / imgW;
      while(sY < canvas.height){
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = Math.min(pagePxH, canvas.height - sY);
        const ctx = slice.getContext("2d");
        ctx.drawImage(canvas, 0, sY, canvas.width, slice.height, 0, 0, slice.width, slice.height);
        pdf.addImage(slice.toDataURL("image/png"), "PNG", margin, margin, imgW, (slice.height * imgW)/slice.width);
        sY += pagePxH;
        if(sY < canvas.height) pdf.addPage();
      }
    }
    
    pdf.save(`plano-de-aula-${Date.now()}.pdf`);
    toast.success('PDF exportado com sucesso!');
    
  } catch (error) {
    console.error('Erro ao exportar PDF:', error);
    toast.error('Erro ao exportar PDF. Tente novamente.');
  } finally {
    loadingManager.hideButtonLoading(exportBtn);
  }
}

function exportToCSV() {
  try {
    const now = new Date();
    const timestamp = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR');
    
    // Headers mais detalhados
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "# Plano de Aula - MestreLúdico\n";
    csvContent += `# Exportado em: ${timestamp}\n`;
    csvContent += `# Tema: ${qs('#prefTheme').value || 'Não informado'}\n`;
    csvContent += `# Turma: ${qs('#prefClass').value || 'Não informada'}\n`;
    csvContent += `# Duração: ${qs('#prefTime').value || 'Não informada'}\n`;
    csvContent += "#\n";
    csvContent += "Seção,Código BNCC,Título,Descrição,Adaptação TEA,Tags\n";

    const { workspace } = appState;
    let totalItems = 0;

    for (const section in workspace) {
      workspace[section].forEach(item => {
        totalItems++;
        const sectionName = {
          'objectives': 'Objetivos',
          'activities': 'Atividades', 
          'games': 'Jogos',
          'assessments': 'Avaliações'
        }[section] || section;
        
        const row = [
          sectionName,
          item.codigo || '',
          `"${(item.titulo || '').replace(/"/g, '""')}"`,
          `"${(item.descricao || '').replace(/"/g, '""')}"`,
          item.tea ? `"${item.tea.replace(/"/g, '""')}"` : '',
          item.tags ? `"${item.tags.join(', ')}"` : ''
        ].join(",");
        csvContent += row + "\n";
      });
    }
    
    // Adicionar estatísticas no final
    csvContent += "\n# Estatísticas\n";
    csvContent += `# Total de itens: ${totalItems}\n`;
    csvContent += `# Seções preenchidas: ${Object.values(workspace).filter(arr => arr.length > 0).length}/4\n`;
    csvContent += `# Modo TEA: ${appState.teaModeActive ? 'Ativo' : 'Inativo'}\n`;

    if (totalItems === 0) {
      toast.warning('Nenhum item encontrado para exportar. Adicione conteúdo ao workspace primeiro.');
      return;
    }

    const encodedUri = encodeURI(csvContent);
    const link = $.el("a", { 
      href: encodedUri, 
      download: `plano-aula-${Date.now()}.csv` 
    });
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`CSV exportado com ${totalItems} itens!`);
    
  } catch (error) {
    console.error('Erro ao exportar CSV:', error);
    toast.error('Erro ao exportar CSV. Tente novamente.');
  }
}

function exportStateJSON(){
  const data = JSON.stringify(appState, null, 2);
  const blob = new Blob([data], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = $.el("a",{href:url, download:`bncc-state-${Date.now()}.json`});
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ---------- UI & Eventos ----------
function selectTab(id){
  ["tab-library","tab-workspace","tab-my", "tab-chatbot", "tab-quiz"].forEach(sec=>{
    const on = sec===id;
    qs("#"+sec).hidden = !on;
    const btn = qs(`#${sec}-btn`);
    if(btn){
      btn.setAttribute("aria-selected", on ? "true" : "false");
      btn.classList.toggle("active", on);
    }
  });
}

function updateStats(){
  appState.stats.skills = appState.selectedSkills?.length || 0;
  appState.stats.items = ["objectives","activities","games","assessments"]
    .reduce((n,k)=> n + appState.workspace[k].length, 0);
  qs("#statSkills").textContent = appState.stats.skills;
  qs("#statItems").textContent = appState.stats.items;
  qs("#statTea").textContent = appState.teaModeActive ? "ligado" : "desligado";
}

function handleFilterChange() {
  renderLibrary();
  qs("#busca").focus();
}

function attachEvents(){
  $.on(qs("#busca"), "input", renderLibrary);
  $.on(qs("#anoSel"), "change", handleFilterChange);
  $.on(qs("#compSel"), "change", handleFilterChange);
  
  // Advanced search event handlers
  const advancedFilters = ['#difficultyFilter', '#durationFilter', '#teaFilter', '#sortBy'];
  advancedFilters.forEach(selector => {
    const element = qs(selector);
    if (element) {
      $.on(element, 'change', renderLibrary);
    }
  });
  
  // Advanced search buttons
  const applyBtn = qs('#applyFilters');
  if (applyBtn) $.on(applyBtn, 'click', renderLibrary);
  
  const clearBtn = qs('#clearFilters');
  if (clearBtn) $.on(clearBtn, 'click', clearAdvancedFilters);
  
  const saveBtn = qs('#saveSearch');
  if (saveBtn) $.on(saveBtn, 'click', saveCurrentSearch);

  $.on(qs("#toggleTeaBtn"), "click", ()=>{
    appState.teaModeActive = !appState.teaModeActive;
    qs("#toggleTeaBtn").setAttribute("aria-pressed", String(appState.teaModeActive));
    updateStats(); saveState();
  });
  
  $.on(qs("#toggleBulkMode"), "click", ()=>{
    toggleBulkMode();
    qs("#toggleBulkMode").setAttribute("aria-pressed", String(bulkMode));
  });
  
  $.on(qs("#toggleTheme"), "click", ()=>{
    themeManager.toggleTheme();
  });

  // Tabs
  $.on(qs("#tab-library-btn"), "click", ()=> selectTab("tab-library"));
  $.on(qs("#tab-workspace-btn"), "click", ()=> selectTab("tab-workspace"));
  $.on(qs("#tab-my-btn"), "click", ()=> selectTab("tab-my"));
  $.on(qs("#tab-chatbot-btn"), "click", ()=> {
    selectTab("tab-chatbot");
    if(!appState.chatbot.active) startChat();
  });
  $.on(qs("#tab-quiz-btn"), "click", () => {
    selectTab("tab-quiz");
    if (!appState.currentQuiz) {
      startNewQuiz();
    }
  });

  // Export modal
  const modal = qs("#exportModal");
  $.on(qs("#openExport"), "click", ()=> modal.setAttribute("open",""));
  $.on(qs("#closeExport"), "click", ()=> modal.removeAttribute("open"));
  qsa("[data-export]").forEach(btn=>{
    $.on(btn, "click", async ()=>{
      const type = btn.dataset.export;
      if(type==="pdf") await exportWorkspaceToPDF();
      if(type==="json") exportStateJSON();
      if(type==="csv") exportToCSV();
    });
  });
  // Quick export buttons
  $.on(qs("#exportJSON"), "click", exportStateJSON);
  $.on(qs("#importJSON"), "change", e=>{
    const file = e.target.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const obj = JSON.parse(reader.result);
        appState = Object.assign({}, appState, obj);
        syncWorkspaceDOM(); renderMyActivities(); updateStats(); saveState();
        toast.success("Estado importado com sucesso.");
      }catch(err){ 
        console.error("Import error:", err);
        toast.error("JSON inválido. Verifique o arquivo."); 
      }
    };
    reader.readAsText(file);
  });

  // Chatbot events
  $.on(qs("#chatSendBtn"), "click", handleChatMessage);
  $.on(qs("#chatInput"), "keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleChatMessage();
    }
  });

  // Quiz creator events
  $.on(qs("#quizTitle"), "change", e => {
    if (appState.currentQuiz) appState.currentQuiz.title = e.target.value;
  });
  $.on(qs("#addQuestionBtn"), "click", addQuestion);
  $.on(qs("#saveQuizBtn"), "click", saveQuiz);

  // Quiz Player events
  $.on(qs("#playerNextBtn"), "click", nextQuestion);
  $.on(qs("#playerCloseBtn"), "click", closeQuizPlayer);

  // AI Assistant events
  $.on(qs("#aiCloseBtn"), "click", closeAiModal);

  // Skill Detail Modal events
  $.on(qs("#skillDetailCloseBtn"), "click", closeSkillDetailModal);

  // Add custom activity
  $.on(qs("#addCustom"), "click", ()=>{
    const title = qs("#customTitle").value.trim();
    const tags = qs("#customTags").value.trim();
    const description = qs("#customDescription").value.trim();
    if(!title){ 
      toast.warning("Dê um título para a atividade."); 
      qs("#customTitle").focus();
      return; 
    }
    appState.myActivities.push({ title, tags, description, media: [] });
    qs("#customTitle").value = ""; qs("#customTags").value = ""; qs("#customDescription").value = "";
    renderMyActivities(); saveState();
    toast.success("Atividade adicionada com sucesso!");
  });
  
  // Template system event handlers
  qsa('.template-card').forEach(card => {
    $.on(card, 'click', () => {
      const templateId = card.dataset.template;
      if (templateId === 'personalizado') {
        clearWorkspace();
      } else {
        applyTemplate(templateId);
      }
    });
  });
  
  // Workspace reset handler
  const resetBtn = qs('#resetWorkspace');
  if (resetBtn) {
    $.on(resetBtn, 'click', resetWorkspaceWithConfirmation);
  }
  
  // Quick filter handlers
  const filterFavBtn = qs('#filterFavorites');
  const filterRecentBtn = qs('#filterRecent');
  const filterAllBtn = qs('#filterAll');
  
  if (filterFavBtn) {
    $.on(filterFavBtn, 'click', () => {
      currentFilters.onlyFavorites = true;
      currentFilters.onlyRecent = false;
      renderLibrary();
      toast.info('Mostrando apenas favoritos');
    });
  }
  
  if (filterRecentBtn) {
    $.on(filterRecentBtn, 'click', () => {
      currentFilters.onlyRecent = true;
      currentFilters.onlyFavorites = false;
      renderLibrary();
      toast.info('Mostrando recentes');
    });
  }
  
  if (filterAllBtn) {
    $.on(filterAllBtn, 'click', () => {
      currentFilters.onlyFavorites = false;
      currentFilters.onlyRecent = false;
      renderLibrary();
      toast.info('Mostrando todas as habilidades');
    });
  }

  // Shortcuts
  document.addEventListener("keydown", e=>{
    if(e.key==="/"){ e.preventDefault(); qs("#busca").focus(); }
    if(e.key==="g"){ selectTab("tab-workspace"); }
  });

  // Preferências simples
  ["prefTheme","prefClass","prefTime"].forEach(id=>{
    const el = qs("#"+id);
    el.value = appState.userProfile[id] || "";
    $.on(el, "input", ()=>{
      appState.userProfile[id] = el.value;
      saveState();
    });
  });
}

function attachHotkeys() {
  /* global hotkeys */
  if (typeof hotkeys === 'undefined') {
    console.warn("hotkeys-js not loaded.");
    return;
  }

  // Tab navigation
  hotkeys('alt+1, ⌘+1', (e) => { e.preventDefault(); selectTab('tab-library'); });
  hotkeys('alt+2, ⌘+2', (e) => { e.preventDefault(); selectTab('tab-workspace'); });
  hotkeys('alt+3, ⌘+3', (e) => { e.preventDefault(); selectTab('tab-my'); });
  hotkeys('alt+4, ⌘+4', (e) => { e.preventDefault(); selectTab('tab-chatbot'); });
  hotkeys('alt+5, ⌘+5', (e) => { e.preventDefault(); selectTab('tab-quiz'); });

  // Quick actions
  hotkeys('ctrl+e, ⌘+e', (e) => {
    e.preventDefault();
    const modal = qs("#exportModal");
    if (modal.hasAttribute("open")) {
      modal.removeAttribute("open");
    } else {
      modal.setAttribute("open", "");
    }
  });

  // Quick export
  hotkeys('ctrl+shift+e, ⌘+shift+e', (e) => {
    e.preventDefault();
    exportStateJSON();
  });

  // Toggle TEA mode
  hotkeys('ctrl+t, ⌘+t', (e) => {
    e.preventDefault();
    appState.teaModeActive = !appState.teaModeActive;
    qs("#toggleTeaBtn").setAttribute("aria-pressed", String(appState.teaModeActive));
    updateStats(); saveState();
    toast.info(`Modo TEA ${appState.teaModeActive ? 'ativado' : 'desativado'}`);
  });

  // Bulk selection
  hotkeys('ctrl+a, ⌘+a', (e) => {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
      return; // Let default behavior work for inputs
    }
    e.preventDefault();
    toggleBulkSelectAll();
  });

  // Delete selected items
  hotkeys('delete, backspace', (e) => {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
      return; // Let default behavior work for inputs
    }
    if (bulkSelection.size > 0) {
      e.preventDefault();
      deleteBulkSelected();
    }
  });

  // Search focus
  hotkeys('ctrl+f, ⌘+f', (e) => {
    e.preventDefault();
    qs('#busca').focus();
  });

  // Clear search
  hotkeys('escape', (e) => {
    if (qs('#busca') === document.activeElement) {
      qs('#busca').value = '';
      renderLibrary();
    }
    // Clear bulk selection
    if (bulkSelection.size > 0) {
      clearBulkSelection();
    }
  });

  // Help
  hotkeys('f1, shift+/', (e) => {
    e.preventDefault();
    showKeyboardShortcutsHelp();
  });

  // Quick add to workspace sections
  hotkeys('ctrl+1, ⌘+1', (e) => {
    e.preventDefault();
    if (lastSelectedSkill) {
      addSkillToSection(lastSelectedSkill, 'objectives');
      toast.success('Adicionado aos Objetivos');
    }
  });

  hotkeys('ctrl+2, ⌘+2', (e) => {
    e.preventDefault();
    if (lastSelectedSkill) {
      addSkillToSection(lastSelectedSkill, 'activities');
      toast.success('Adicionado às Atividades');
    }
  });

  hotkeys('ctrl+3, ⌘+3', (e) => {
    e.preventDefault();
    if (lastSelectedSkill) {
      addSkillToSection(lastSelectedSkill, 'games');
      toast.success('Adicionado aos Jogos');
    }
  });

  hotkeys('ctrl+4, ⌘+4', (e) => {
    e.preventDefault();
    if (lastSelectedSkill) {
      addSkillToSection(lastSelectedSkill, 'assessments');
      toast.success('Adicionado às Avaliações');
    }
  });
}

function handleRouting(){
  const hash = window.location.hash.substring(1);
  if (['tab-library', 'tab-workspace', 'tab-my'].includes(hash)) {
    selectTab(hash);
  }
}

// ---------- PWA Install ----------
function setupPWAInstall() {
  let deferredPrompt;
  const installBtn = qs("#installPWA");

  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });

  installBtn.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        console.log("PWA installation accepted");
      } else {
        console.log("PWA installation dismissed");
      }
      deferredPrompt = null;
      installBtn.hidden = true;
    }
  });

  window.addEventListener("appinstalled", () => {
    console.log("PWA was installed");
    installBtn.hidden = true;
  });
}

// ---------- Init ----------
(async function init(){
  await loadBNCC();
  attachEvents();
  setupPWAInstall();
  enableDnD();
  renderLibrary();
  syncWorkspaceDOM();
  enableSortable();
  renderMyActivities();
  updateStats();

  window.addEventListener('hashchange', handleRouting, false);
  handleRouting();

  // Render initial chat messages if any
  renderChatMessages();
  // Render quiz editor if a quiz is in progress
  renderQuizEditor();
  // Render the list of saved quizzes
  renderQuizzesList();
  // Render saved searches
  renderSavedSearches();
  // Check for first visit and show onboarding
  checkFirstVisit();
  // Attach all keyboard shortcuts
  attachHotkeys();
})();
