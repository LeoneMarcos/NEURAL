/**
 * NEURAL — Setup / Onboarding Module
 * Two-step pre-configuration screen:
 *   Step 1: Select news portals (sources)
 *   Step 2: Select language (EN or PT-BR)
 * Saves preferences to localStorage, then calls onComplete callback.
 */

import { SOURCES } from './feed.js';

const PREFS_KEY = 'neural_user_prefs';

/**
 * Load saved preferences from localStorage.
 * Returns null if not set (means setup hasn't been completed).
 */
export function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Save preferences to localStorage.
 * @param {{ sources: string[], lang: string }} prefs
 */
function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}

/**
 * Clear saved preferences (used for "reset" / "change settings").
 */
export function clearPrefs() {
  localStorage.removeItem(PREFS_KEY);
}

/**
 * Mount and show the two-step setup overlay.
 * @param {function} onComplete - called with { sources: string[], lang: string } when done
 */
export function showSetup(onComplete) {
  // ─── Build overlay ───────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'setup-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Neural setup');

  overlay.innerHTML = `
    <div class="setup-bg-grid"></div>
    <div class="setup-modal" id="setup-modal">

      <!-- Header -->
      <div class="setup-header">
        <div class="setup-logo-row">
          <img src="./favicon.png" alt="Neural logo" class="setup-logo-img" />
          <span class="setup-logo-text">Neural</span>
        </div>
        <p class="setup-subtitle" id="setup-subtitle">Configure your experience</p>
      </div>

      <!-- Step indicator -->
      <div class="setup-steps-indicator" aria-hidden="true">
        <div class="step-dot active" id="dot-1"></div>
        <div class="step-line" id="step-line"></div>
        <div class="step-dot" id="dot-2"></div>
      </div>

      <!-- Step 1: Source selection -->
      <div id="step-1" class="setup-step active-step">
        <h2 class="setup-step-title">
          <span class="material-symbols-outlined step-icon">newsstand</span>
          Choose your news portals
        </h2>
        <p class="setup-step-desc">Select at least one source to follow.</p>
        <div class="sources-grid" id="sources-grid"></div>
        <div class="setup-actions">
          <button id="select-all-btn" class="btn-ghost" type="button">Select all</button>
          <button id="step1-next" class="btn-primary" type="button" disabled>
            Next <span class="material-symbols-outlined btn-icon">arrow_forward</span>
          </button>
        </div>
      </div>

      <!-- Step 2: Language selection -->
      <div id="step-2" class="setup-step">
        <h2 class="setup-step-title">
          <span class="material-symbols-outlined step-icon">translate</span>
          Choose your language
        </h2>
        <p class="setup-step-desc">How would you like to read the news?</p>
        <div class="lang-grid" id="lang-grid">
          <button class="lang-card" data-lang="en" id="lang-en" type="button" aria-pressed="false">
            <span class="lang-flag">🇺🇸</span>
            <span class="lang-name">English</span>
            <span class="lang-desc">Read articles in their original language</span>
          </button>
          <button class="lang-card" data-lang="pt" id="lang-pt" type="button" aria-pressed="false">
            <span class="lang-flag">🇧🇷</span>
            <span class="lang-name">Português</span>
            <span class="lang-desc">Artigos traduzidos para PT-BR automaticamente</span>
          </button>
        </div>
        <div class="setup-actions">
          <button id="step2-back" class="btn-ghost" type="button">
            <span class="material-symbols-outlined btn-icon">arrow_back</span> Back
          </button>
          <button id="step2-finish" class="btn-primary" type="button" disabled>
            Launch Neural <span class="material-symbols-outlined btn-icon">rocket_launch</span>
          </button>
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  // Force reflow then add visible class for entrance animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.classList.add('setup-visible');
    });
  });

  // ─── State ────────────────────────────────────────────────────────────
  let selectedSources = new Set();
  let selectedLang = null;

  // ─── Render source cards ──────────────────────────────────────────────
  const sourcesGrid = overlay.querySelector('#sources-grid');
  SOURCES.forEach(source => {
    const card = document.createElement('button');
    card.className = 'source-card';
    card.type = 'button';
    card.dataset.id = source.id;
    card.setAttribute('aria-pressed', 'false');
    card.innerHTML = `
      <span class="source-check material-symbols-outlined">check_circle</span>
      <span class="source-name">${source.name}</span>
    `;
    card.addEventListener('click', () => toggleSource(source.id, card));
    sourcesGrid.appendChild(card);
  });

  function toggleSource(id, card) {
    if (selectedSources.has(id)) {
      selectedSources.delete(id);
      card.classList.remove('selected');
      card.setAttribute('aria-pressed', 'false');
    } else {
      selectedSources.add(id);
      card.classList.add('selected');
      card.setAttribute('aria-pressed', 'true');
    }
    updateStep1Next();
    updateSelectAllBtn();
  }

  function updateStep1Next() {
    const btn = overlay.querySelector('#step1-next');
    btn.disabled = selectedSources.size === 0;
  }

  function updateSelectAllBtn() {
    const btn = overlay.querySelector('#select-all-btn');
    const allSelected = selectedSources.size === SOURCES.length;
    btn.textContent = allSelected ? 'Deselect all' : 'Select all';
  }

  // ─── Select / deselect all ────────────────────────────────────────────
  overlay.querySelector('#select-all-btn').addEventListener('click', () => {
    const allSelected = selectedSources.size === SOURCES.length;
    const cards = sourcesGrid.querySelectorAll('.source-card');
    cards.forEach(card => {
      const id = card.dataset.id;
      if (allSelected) {
        selectedSources.delete(id);
        card.classList.remove('selected');
        card.setAttribute('aria-pressed', 'false');
      } else {
        selectedSources.add(id);
        card.classList.add('selected');
        card.setAttribute('aria-pressed', 'true');
      }
    });
    updateStep1Next();
    updateSelectAllBtn();
  });

  // ─── Step navigation ──────────────────────────────────────────────────
  function goToStep(step) {
    overlay.querySelector('#step-1').classList.toggle('active-step', step === 1);
    overlay.querySelector('#step-2').classList.toggle('active-step', step === 2);
    overlay.querySelector('#dot-1').classList.toggle('active', step >= 1);
    overlay.querySelector('#dot-1').classList.toggle('done', step > 1);
    overlay.querySelector('#dot-2').classList.toggle('active', step === 2);
    overlay.querySelector('#step-line').classList.toggle('filled', step > 1);

    const subtitle = overlay.querySelector('#setup-subtitle');
    subtitle.textContent = step === 1
      ? 'Step 1 of 2 — Select your sources'
      : 'Step 2 of 2 — Choose your language';
  }

  overlay.querySelector('#step1-next').addEventListener('click', () => goToStep(2));
  overlay.querySelector('#step2-back').addEventListener('click', () => goToStep(1));

  // ─── Language selection ───────────────────────────────────────────────
  overlay.querySelectorAll('.lang-card').forEach(card => {
    card.addEventListener('click', () => {
      selectedLang = card.dataset.lang;
      overlay.querySelectorAll('.lang-card').forEach(c => {
        c.classList.toggle('selected', c === card);
        c.setAttribute('aria-pressed', c === card ? 'true' : 'false');
      });
      overlay.querySelector('#step2-finish').disabled = false;
    });
  });

  // ─── Finish ───────────────────────────────────────────────────────────
  overlay.querySelector('#step2-finish').addEventListener('click', () => {
    const prefs = {
      sources: [...selectedSources],
      lang: selectedLang,
    };
    savePrefs(prefs);

    // Exit animation
    overlay.classList.remove('setup-visible');
    overlay.classList.add('setup-exit');
    overlay.addEventListener('transitionend', () => {
      overlay.remove();
      onComplete(prefs);
    }, { once: true });
  });
}
