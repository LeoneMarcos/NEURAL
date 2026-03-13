import * as Sentry from "@sentry/browser";
import { fetchAllFeeds, SOURCES } from './feed.js';
import { timeAgo, timeAgoPt, escapeHtml } from './utils.js';
import { translateArticle } from './translate.js';
import { showSetup, loadPrefs, clearPrefs } from './setup.js';

// Sentry Initialization
if (import.meta.env.PROD) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: 1.0, 
    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

let articles = [];
let currentFilter = 'all';
let currentLang = 'en'; // default language
let activeSources = SOURCES.map(s => s.id); // default: all sources

// ── UI string dictionary ──────────────────────────────────────────────────────
const UI_STRINGS = {
  en: {
    tagline:    'AI News Aggregator',
    sources:    'Sources',
    allSources: 'All Sources',
    noArticles: 'No articles found.',
    readMore:   'Read more',
    translating: (n, total) => `Translating ${n} / ${total}…`,
  },
  pt: {
    tagline:    'Agregador de Notícias de IA',
    sources:    'Fontes',
    allSources: 'Todas as fontes',
    noArticles: 'Nenhum artigo encontrado.',
    readMore:   'Leia mais',
    translating: (n, total) => `Traduzindo ${n} / ${total}…`,
  },
};

/** Shorthand — returns the string for the current language */
const t = (key, ...args) => {
  const entry = UI_STRINGS[currentLang]?.[key] ?? UI_STRINGS.en[key];
  return typeof entry === 'function' ? entry(...args) : entry;
};

const newsGrid = document.getElementById('news-grid');
const sidebarNav = document.getElementById('sidebar-nav');
const settingsBtn = document.getElementById('settings-btn');

async function init() {
  const prefs = loadPrefs();

  if (!prefs) {
    // First launch — show setup wizard
    showSetup(async (selectedPrefs) => {
      applyPrefs(selectedPrefs);
      await loadFeed();
    });
    return;
  }

  // Prefs already saved — apply and go
  applyPrefs(prefs);
  await loadFeed();
}

/**
 * Apply saved preferences to app state and UI
 */
function applyPrefs(prefs) {
  activeSources = prefs.sources && prefs.sources.length > 0 ? prefs.sources : SOURCES.map(s => s.id);
  currentLang = prefs.lang || 'en';
  currentFilter = 'all';
  applyUITranslation();
  renderSidebar();
}

/**
 * Update all static UI strings to the current language.
 */
function applyUITranslation() {
  const taglineEl      = document.getElementById('ui-tagline');
  const sourcesLabelEl = document.getElementById('ui-sources-label');
  if (taglineEl)      taglineEl.textContent      = t('tagline');
  if (sourcesLabelEl) sourcesLabelEl.textContent = t('sources');
  // Update html lang attribute
  document.documentElement.lang = currentLang === 'pt' ? 'pt-BR' : 'en';
}

/**
 * Fetch feed, translate in memory if PT, then render once — skeleton stays visible until done.
 */
async function loadFeed() {
  renderLoading();
  try {
    articles = await fetchAllFeeds({ selectedSourceIds: activeSources });

    // Translate all articles in memory BEFORE rendering —
    // the loading skeleton stays visible until every article is ready.
    if (currentLang === 'pt') {
      articles = await translateAllInMemory(articles);
    }

    renderFeed();
  } catch (error) {
    console.error('Error fetching feeds:', error);
    newsGrid.innerHTML = '<p class="text-red-500">Failed to load news.</p>';
  }
}

/**
 * Translate an array of articles to PT in memory.
 * Shows a "Traduzindo X / N" counter in the loading skeleton.
 * @param {object[]} rawArticles
 * @returns {Promise<object[]>} fully translated articles
 */
async function translateAllInMemory(rawArticles) {
  const hint = document.createElement('p');
  hint.id = 'translate-hint';
  hint.className = 'text-brand-muted text-xs font-mono col-span-full text-center mt-2';
  hint.textContent = t('translating', 0, rawArticles.length);
  newsGrid.appendChild(hint);

  const translated = [];
  for (let i = 0; i < rawArticles.length; i++) {
    try {
      translated.push(await translateArticle(rawArticles[i]));
    } catch {
      translated.push(rawArticles[i]);
    }
    hint.textContent = t('translating', i + 1, rawArticles.length);
  }
  return translated;
}

function renderSidebar() {
  sidebarNav.innerHTML = '';
  
  const allSourcesLink = createSidebarLink('all', t('allSources'), currentFilter === 'all');
  allSourcesLink.addEventListener('click', (e) => {
    e.preventDefault();
    setFilter('all');
  });
  sidebarNav.appendChild(allSourcesLink);

  // Only show the sources the user chose during setup
  const visibleSources = SOURCES.filter(s => activeSources.includes(s.id));
  visibleSources.forEach(source => {
    const link = createSidebarLink(source.id, source.name, currentFilter === source.id);
    link.addEventListener('click', (e) => {
      e.preventDefault();
      setFilter(source.id);
    });
    sidebarNav.appendChild(link);
  });
}

function createSidebarLink(id, name, isActive) {
  const a = document.createElement('a');
  a.href = '#';
  a.className = isActive 
    ? 'block active-nav-item font-bold text-sm px-4 py-2.5 transition-all font-mono'
    : 'block text-white text-sm hover:text-brand-accent transition-colors font-mono';
  a.style.fontFamily = "'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace";
  a.textContent = name;
  return a;
}

function setFilter(filterId) {
  currentFilter = filterId;
  renderSidebar(); // Update active state
  renderFeed();
}

/**
 * Register global UI listeners once on boot — never call more than once.
 */
function registerGlobalListeners() {
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      clearPrefs();
      showSetup(async (selectedPrefs) => {
        articles = [];
        applyPrefs(selectedPrefs);
        await loadFeed();
      });
    });
  }
}


function renderLoading() {
  newsGrid.innerHTML = '';
  const count = 6;
  for (let i = 0; i < count; i++) {
    const card = document.createElement('div');
    card.className = 'bg-brand-card rounded-xl border border-brand-border overflow-hidden flex flex-col animate-pulse min-h-[200px]';
    card.style.animationDelay = `${i * 0.08}s`;
    card.innerHTML = `
      <div class="p-6 flex flex-col flex-1">
        <div class="h-6 bg-brand-sidebar mb-4 rounded-md w-3/4"></div>
        <div class="h-4 bg-brand-sidebar rounded-md w-full mb-2"></div>
        <div class="h-4 bg-brand-sidebar rounded-md w-11/12 mb-2"></div>
        <div class="h-4 bg-brand-sidebar rounded-md w-4/5 mb-6"></div>
        <div class="mt-auto flex justify-between items-center pt-4 border-t border-brand-border/50">
          <div class="h-3 bg-brand-sidebar rounded w-16"></div>
          <div class="h-3 bg-brand-sidebar rounded w-20"></div>
        </div>
      </div>
    `;
    newsGrid.appendChild(card);
  }
}

function renderFeed() {
  newsGrid.innerHTML = '';
  
  let filteredArticles = articles;
  if (currentFilter !== 'all') {
    filteredArticles = articles.filter(a => a.sourceId === currentFilter);
  }

  if (filteredArticles.length === 0) {
    newsGrid.innerHTML = `<p class="text-brand-muted col-span-1 md:col-span-2 xl:col-span-3">${t('noArticles')}</p>`;
    return;
  }

  filteredArticles.forEach(article => {
    const card = document.createElement('article');
    card.className = 'bg-brand-card rounded-xl border border-brand-border overflow-hidden flex flex-col group hover:border-brand-accent/50 transition-colors cursor-pointer';
    card.addEventListener('click', () => { window.open(article.link, '_blank'); });
    
    card.innerHTML = `
      <div class="p-6 flex flex-col flex-1">
        <h3 class="text-lg font-bold text-white mb-3 card-title leading-snug group-hover:text-brand-accent transition-colors">
          ${escapeHtml(article.title)}
        </h3>
        <p class="text-brand-muted text-sm mb-6">
          ${escapeHtml(article.description)}
        </p>
        <div class="mt-auto flex justify-between items-center pt-4 border-t border-brand-border/50">
          <span class="text-brand-muted text-xs font-mono">${currentLang === 'pt' ? timeAgoPt(article.pubDate) : timeAgo(article.pubDate)}</span>
          <a class="text-brand-accent text-xs font-bold hover:underline flex items-center gap-1" href="${escapeHtml(article.link)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();">
            ${t('readMore')} <span class="text-[14px]">→</span>
          </a>
        </div>
      </div>
    `;
    newsGrid.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  registerGlobalListeners();
  init();
});
