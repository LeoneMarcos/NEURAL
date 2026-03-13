/**
 * NEURAL — RSS Feed Module
 * Fetches and normalizes news from multiple AI sources.
 * Uses multiple CORS proxy strategies with client-side XML parsing.
 */

import { isWithinHours, stripHtml, decodeHtmlEntities } from './utils.js';

/**
 * CORS proxy list — tries in order until one works
 */
const CORS_PROXIES = [
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`,
];

/**
 * Feed source definitions
 */
export const SOURCES = [
  {
    id: 'techcrunch',
    name: 'TechCrunch',
    feedUrl: 'https://techcrunch.com/category/artificial-intelligence/feed/',
  },
  {
    id: 'marktechpost',
    name: 'MarkTechPost',
    feedUrl: 'https://www.marktechpost.com/feed/',
  },
  {
    id: 'mit',
    name: 'MIT Tech Review',
    feedUrl: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/',
  },
  {
    id: 'venturebeat',
    name: 'VentureBeat',
    feedUrl: 'https://venturebeat.com/category/ai/feed/',
  },
  {
    id: 'theverge',
    name: 'The Verge',
    feedUrl: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    feedUrl: 'https://blog.google/products-and-platforms/products/gemini/rss/',
  }
];

const CACHE_KEY = 'neural_feed_cache';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Fetch a single RSS feed — tries each CORS proxy in order until one succeeds.
 */
async function fetchSingleFeed(source) {
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxyUrl = CORS_PROXIES[i](source.feedUrl);
    const isRss2Json = proxyUrl.includes('rss2json.com');

    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) continue; // Try next proxy

      if (isRss2Json) {
        // rss2json returns JSON directly
        const data = await response.json();
        if (data.status !== 'ok' || !data.items?.length) continue;
        return data.items.map((item) => normalizeFeedItem(item, source));
      } else {
        // CORS proxy returns raw XML — parse client-side
        const xmlText = await response.text();
        const items = parseRssXml(xmlText, source);
        if (items.length > 0) return items;
      }
    } catch {
      // Silently try next proxy
    }
  }

  console.warn(`[NEURAL] All proxies failed for ${source.name}`);
  return [];
}

/**
 * Parse RSS/Atom XML into normalized items
 */
function parseRssXml(xmlText, source) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');

  // Check for parse errors
  if (doc.querySelector('parsererror')) return [];

  const items = [];

  // Try RSS 2.0 <item> elements, then Atom <entry>
  let entries = doc.querySelectorAll('item');
  if (entries.length === 0) entries = doc.querySelectorAll('entry');

  entries.forEach((entry) => {
    try {
      const item = parseXmlEntry(entry, source);
      if (item) items.push(item);
    } catch {
      // Skip malformed entries
    }
  });

  return items;
}

/**
 * Parse a single RSS <item> or Atom <entry>
 */
function parseXmlEntry(entry, source) {
  const title = xmlText(entry, 'title') || '';
  if (!title) return null;

  // Link — RSS uses <link> text, Atom uses <link href="...">
  let link = xmlText(entry, 'link') || '';
  if (!link) {
    const linkEls = entry.getElementsByTagName('link');
    for (const el of linkEls) {
      const href = el.getAttribute('href');
      if (href) { link = href; break; }
    }
  }

  // Description / content (try multiple tag names including namespaced ones)
  const contentEncoded = xmlText(entry, 'content:encoded') || xmlText(entry, 'content');
  const description = contentEncoded
    || xmlText(entry, 'description')
    || xmlText(entry, 'summary')
    || '';

  // Date
  const pubDate = xmlText(entry, 'pubDate')
    || xmlText(entry, 'published')
    || xmlText(entry, 'updated')
    || new Date().toISOString();

  // Author
  const author = xmlText(entry, 'dc:creator')
    || xmlText(entry, 'author')
    || source.name;

  const htmlContent = contentEncoded || description;

  return normalizeFeedItem({
    title,
    link,
    description,
    pubDate,
    author,
    content: htmlContent || description,
  }, source);
}

/**
 * Get text content of a child element using getElementsByTagName (handles XML namespaces)
 */
function xmlText(parent, tagName) {
  try {
    const els = parent.getElementsByTagName(tagName);
    if (els.length > 0) return els[0].textContent?.trim() || '';
    return '';
  } catch {
    return '';
  }
}

/**
 * Normalize a feed item into a unified format
 */
function normalizeFeedItem(item, source) {
  return {
    id: `${source.id}_${simpleHash(item.link || item.title)}`,
    sourceId: source.id,
    sourceName: source.name,
    title: decodeHtmlEntities(item.title || ''),
    description: stripHtml(item.content || item.description || '').substring(0, 600) + (stripHtml(item.content || item.description || '').length > 600 ? '...' : ''),
    link: item.link || '',
    pubDate: item.pubDate || new Date().toISOString(),
    author: item.author || source.name,
  };
}

/**
 * Simple string hash (avoids btoa unicode issues)
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Load from localStorage cache
 */
function loadCache(key = CACHE_KEY) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.articles;
  } catch {
    return null;
  }
}

/**
 * Save to localStorage cache
 */
function saveCache(key = CACHE_KEY, articles) {
  try {
    localStorage.setItem(key, JSON.stringify({
      timestamp: Date.now(),
      articles,
    }));
  } catch {
    // Storage full — ignore
  }
}

/**
 * Fetch all feeds, merge, sort, and filter to last 24 hours
 * @param {{ forceRefresh?: boolean, hoursLimit?: number, selectedSourceIds?: string[] }} options
 */
export async function fetchAllFeeds({ forceRefresh = false, hoursLimit = 24, selectedSourceIds = null } = {}) {
  // Determine which sources to fetch
  const activeSources = selectedSourceIds && selectedSourceIds.length > 0
    ? SOURCES.filter(s => selectedSourceIds.includes(s.id))
    : SOURCES;

  // Cache key is namespaced by source selection so different configs don't collide
  const sourceKey = activeSources.map(s => s.id).sort().join(',');
  const cacheKey = `${CACHE_KEY}_${sourceKey}`;

  if (!forceRefresh) {
    const cached = loadCache(cacheKey);
    if (cached) {
      console.log('[NEURAL] Loaded from cache');
      return filterByHours(cached, hoursLimit);
    }
  }

  // Stagger requests by 250ms to prevent rate limiting from CORS proxies
  const promises = activeSources.map(async (source, index) => {
    await new Promise(r => setTimeout(r, index * 250));
    return fetchSingleFeed(source);
  });
  
  const results = await Promise.allSettled(promises);

  let allArticles = [];
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      allArticles = allArticles.concat(result.value);
    }
  });

  allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  saveCache(cacheKey, allArticles);
  return filterByHours(allArticles, hoursLimit);
}

/**
 * Filter articles within the specified hour window.
 * Falls back to latest 30 if none found in window.
 */
function filterByHours(articles, hours) {
  const filtered = articles.filter((a) => isWithinHours(a.pubDate, hours));
  if (filtered.length === 0 && articles.length > 0) {
    return articles.slice(0, 30);
  }
  return filtered;
}
