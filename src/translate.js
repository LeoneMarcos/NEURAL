/**
 * NEURAL — Translation Module
 * Uses MyMemory Translation API (no AI — human translation memory only)
 * https://mymemory.translated.net/doc/spec.php
 */

const API_BASE = 'https://api.mymemory.translated.net/get';
const CACHE_KEY = 'neural_translations';
const RATE_LIMIT_MS = 1200; // 1.2s between requests to avoid rate limiting

let lastRequestTime = 0;
let translationCache = loadTranslationCache();
let requestQueue = Promise.resolve();

/**
 * Load translation cache from localStorage
 */
function loadTranslationCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Save translation cache to localStorage
 */
function saveTranslationCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(translationCache));
  } catch {
    // Storage full — prune oldest entries
    const keys = Object.keys(translationCache);
    if (keys.length > 200) {
      keys.slice(0, 100).forEach((k) => delete translationCache[k]);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(translationCache));
      } catch { /* ignore */ }
    }
  }
}

/**
 * Wait for rate limit
 */
async function waitForRateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

/**
 * Translate a single text from English to Portuguese
 * Uses MyMemory with mt=1 (allow machine translation fallback for better coverage)
 * @param {string} text
 * @returns {Promise<string>} translated text
 */
async function translateText(text) {
  if (!text || text.trim().length === 0) return text;

  // Check cache
  const cacheKey = text.substring(0, 200);
  if (translationCache[cacheKey]) {
    return translationCache[cacheKey];
  }

  // Queue requests to strictly enforce the 1.2s delay without overlaps
  return requestQueue = requestQueue.then(async () => {
    await waitForRateLimit();

    try {
      // Limit text length for API to a generous 1500 chars (MyMemory allows up to 500/day normally without email, but with email we can send larger chunks)
      const trimmed = text.substring(0, 1500);
      const params = new URLSearchParams({
        q: trimmed,
        langpair: 'en|pt-BR',
        de: 'neural.opensource.project@gmail.com' // Increases Daily Limit to 50,000 chars
      });

      const response = await fetch(`${API_BASE}?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        const translated = data.responseData.translatedText;
        
        if (translated.includes('MYMEMORY WARNING')) {
          throw new Error('Quota exceeded');
        }

        // Cache the result
        translationCache[cacheKey] = translated;
        saveTranslationCache();
        return translated;
      }

      throw new Error(data.responseDetails || 'Translation failed');
    } catch (err) {
      console.warn('[NEURAL] Translation error:', err.message);
      return text; // Fallback to original
    }
  });
}

/**
 * Translate an article's title and description
 * @param {object} article
 * @returns {Promise<object>} article with translated fields
 */
export async function translateArticle(article) {
  const translatedTitle = await translateText(article.title);
  const translatedDesc = await translateText(article.description);

  return {
    ...article,
    originalTitle: article.title,
    originalDescription: article.description,
    title: translatedTitle,
    description: translatedDesc,
    isTranslated: true,
  };
}

/**
 * Translate a batch of articles with progress callback
 * @param {Array} articles
 * @param {function} onProgress - callback(current, total)
 * @returns {Promise<Array>} translated articles
 */
export async function translateArticles(articles, onProgress) {
  const results = [];

  for (let i = 0; i < articles.length; i++) {
    const translated = await translateArticle(articles[i]);
    results.push(translated);
    if (onProgress) onProgress(i + 1, articles.length);
  }

  return results;
}

/**
 * Restore original (English) text of articles
 */
export function restoreOriginal(articles) {
  return articles.map((a) => {
    if (a.isTranslated && a.originalTitle) {
      return {
        ...a,
        title: a.originalTitle,
        description: a.originalDescription,
        isTranslated: false,
      };
    }
    return a;
  });
}

/**
 * Clear translation cache
 */
export function clearTranslationCache() {
  translationCache = {};
  localStorage.removeItem(CACHE_KEY);
}
