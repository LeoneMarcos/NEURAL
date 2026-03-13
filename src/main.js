import * as Sentry from "@sentry/browser";
import { fetchAllFeeds, SOURCES } from './feed.js';
import { timeAgo, timeAgoPt, escapeHtml } from './utils.js';
import { translateArticle, restoreOriginal } from './translate.js';

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

const newsGrid = document.getElementById('news-grid');
const sidebarNav = document.getElementById('sidebar-nav');
const langToggle = document.getElementById('lang-toggle');

async function init() {
  renderSidebar();
  setupListeners();
  renderLoading();
  try {
    articles = await fetchAllFeeds();
    renderFeed();
  } catch (error) {
    console.error('Error fetching feeds:', error);
    newsGrid.innerHTML = '<p class="text-red-500">Failed to load news.</p>';
  }
}

function renderSidebar() {
  sidebarNav.innerHTML = '';
  
  const allSourcesLink = createSidebarLink('all', 'All Sources', currentFilter === 'all');
  allSourcesLink.addEventListener('click', (e) => {
    e.preventDefault();
    setFilter('all');
  });
  sidebarNav.appendChild(allSourcesLink);

  SOURCES.forEach(source => {
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

function setupListeners() {
  if (langToggle) {
    langToggle.addEventListener('click', toggleLanguage);
  }
}

async function toggleLanguage() {
  langToggle.disabled = true;
  langToggle.classList.add('opacity-50', 'pointer-events-none');

  const isTranslatingToPt = currentLang === 'en';
  currentLang = isTranslatingToPt ? 'pt' : 'en';

  if (isTranslatingToPt) {
    updateLangUI('pt');
  } else {
    updateLangUI('en');
  }

  let filteredArticles = articles;
  if (currentFilter !== 'all') {
    filteredArticles = articles.filter(a => a.sourceId === currentFilter);
  }

  const cards = newsGrid.children;

  for (let i = 0; i < filteredArticles.length; i++) {
    const cardEl = cards[i];

    if (cardEl) {
      // Glow and pulse effect to show processing
      cardEl.classList.add('animate-pulse', 'border-brand-accent');
      cardEl.style.boxShadow = '0 0 15px 2px rgba(0, 255, 65, 0.4)';
    }

    try {
      if (isTranslatingToPt) {
        const translated = await translateArticle(filteredArticles[i]);
        const idx = articles.findIndex(a => a.id === translated.id);
        if (idx !== -1) articles[idx] = translated;
        filteredArticles[i] = translated;
      } else {
        const restored = restoreOriginal([filteredArticles[i]])[0];
        const idx = articles.findIndex(a => a.id === restored.id);
        if (idx !== -1) articles[idx] = restored;
        filteredArticles[i] = restored;
      }
      
      // Cascade down effect: artificially await to ensure the glow animation
      // is visible even if the text was instantly loaded from cache
      await new Promise(r => setTimeout(r, 150));
    } catch (e) {
      console.error('Translation failed for card', e);
    }

    if (cardEl) {
      cardEl.classList.remove('animate-pulse', 'border-brand-accent');
      cardEl.style.boxShadow = '';
      
      const titleEl = cardEl.querySelector('h3');
      const descEl = cardEl.querySelector('p');
      const timeEl = cardEl.querySelector('.mt-auto span');
      const readMoreEl = cardEl.querySelector('.mt-auto a');
      
      if (titleEl) titleEl.innerText = filteredArticles[i].title;
      if (descEl) descEl.innerText = filteredArticles[i].description;
      if (timeEl) timeEl.innerText = currentLang === 'pt' ? timeAgoPt(filteredArticles[i].pubDate) : timeAgo(filteredArticles[i].pubDate);
      if (readMoreEl) readMoreEl.innerHTML = `${currentLang === 'pt' ? 'Leia mais' : 'Read more'} <span class="text-[14px]">→</span>`;
    }
  }

  langToggle.classList.remove('opacity-50', 'pointer-events-none');
  langToggle.disabled = false;
}

function updateLangUI(lang) {
  if (!langToggle) return;
  const isPt = lang === 'pt';
  langToggle.setAttribute('aria-label', isPt ? 'Read in English' : 'Traduzir página para Português');
  langToggle.setAttribute('title', isPt ? 'Read in English' : 'Traduzir página');
  langToggle.innerHTML = `
    <span class="material-symbols-outlined text-[16px]">translate</span>
    <span>${isPt ? 'Read in English' : 'Traduzir (PT-BR)'}</span>
  `;
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
    newsGrid.innerHTML = '<p class="text-brand-muted col-span-1 md:col-span-2 xl:col-span-3">No articles found.</p>';
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
            ${currentLang === 'pt' ? 'Leia mais' : 'Read more'} <span class="text-[14px]">→</span>
          </a>
        </div>
      </div>
    `;
    newsGrid.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', init);
