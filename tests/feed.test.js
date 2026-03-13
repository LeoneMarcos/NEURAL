import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAllFeeds, SOURCES } from '../src/feed.js';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn(key => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
    removeItem: vi.fn(key => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; })
  };
})();
global.localStorage = localStorageMock;

// Mock fetch
global.fetch = vi.fn();

const RSS_XML = `
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <item>
      <title>RSS Title</title>
      <link>https://rss.com</link>
      <description>RSS Desc</description>
      <pubDate>${new Date().toISOString()}</pubDate>
      <dc:creator>RSS Author</dc:creator>
    </item>
  </channel>
</rss>`;

const ATOM_XML = `
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Atom Title</title>
    <link href="https://atom.com"/>
    <summary>Atom Summary</summary>
    <updated>${new Date().toISOString()}</updated>
    <author><name>Atom Author</name></author>
  </entry>
</feed>`;

describe('feed.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should parse RSS 2.0 correctly', async () => {
    // Mock for all 3 proxies just in case, but first one should work
    fetch.mockResolvedValue({ ok: true, text: async () => RSS_XML });
    
    const originalSources = [...SOURCES];
    SOURCES.length = 0;
    SOURCES.push({ id: 'rss', name: 'RSS', feedUrl: 'https://rss.com/feed' });

    const articles = await fetchAllFeeds({ forceRefresh: true });
    expect(articles.length).toBeGreaterThan(0);
    expect(articles[0].title).toBe('RSS Title');
    
    SOURCES.length = 0;
    SOURCES.push(...originalSources);
  });

  it('should parse Atom correctly', async () => {
    fetch.mockResolvedValue({ ok: true, text: async () => ATOM_XML });
    
    const originalSources = [...SOURCES];
    SOURCES.length = 0;
    SOURCES.push({ id: 'atom', name: 'Atom', feedUrl: 'https://atom.com/feed' });

    const articles = await fetchAllFeeds({ forceRefresh: true });
    expect(articles.length).toBeGreaterThan(0);
    expect(articles[0].title).toBe('Atom Title');
    
    SOURCES.length = 0;
    SOURCES.push(...originalSources);
  });

  it('should rotate proxies if the first ones fail', async () => {
    // Proxy 1 fails, Proxy 2 fails, Proxy 3 (rss2json) succeeds
    fetch.mockResolvedValueOnce({ ok: false }); 
    fetch.mockResolvedValueOnce({ ok: false });
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'ok',
        items: [{ title: 'Proxy Success', link: 'https://proxy.com', pubDate: new Date().toISOString() }]
      })
    });

    const originalSources = [...SOURCES];
    SOURCES.length = 0;
    SOURCES.push({ id: 'test', name: 'Test', feedUrl: 'https://test.com/rss' });

    const articles = await fetchAllFeeds({ forceRefresh: true });
    expect(articles.length).toBeGreaterThan(0);
    expect(articles[0].title).toBe('Proxy Success');
    
    SOURCES.length = 0;
    SOURCES.push(...originalSources);
  });

  it('should handle invalid XML gracefully', async () => {
    fetch.mockResolvedValue({ ok: true, text: async () => '<invalid' });
    const articles = await fetchAllFeeds({ forceRefresh: true });
    expect(articles.length).toBe(0);
  });

  it('should load from cache if available', async () => {
    const cachedData = {
      timestamp: Date.now(),
      articles: [{ title: 'Cached', pubDate: new Date().toISOString() }]
    };
    localStorage.getItem.mockReturnValue(JSON.stringify(cachedData));
    const articles = await fetchAllFeeds();
    expect(articles[0].title).toBe('Cached');
  });

  it('should ignore expired cache', async () => {
    const expiredData = { timestamp: 0, articles: [] };
    localStorage.getItem.mockReturnValue(JSON.stringify(expiredData));
    fetch.mockResolvedValue({ ok: false });
    await fetchAllFeeds();
    expect(localStorage.removeItem).toHaveBeenCalledWith('neural_feed_cache');
  });

  it('should fallback to latest 30 if none in window', async () => {
    const cachedData = {
      timestamp: Date.now(),
      articles: Array.from({ length: 50 }, (_, i) => ({
        pubDate: '2000-01-01',
        title: `Old ${i}`,
        link: `${i}`
      }))
    };
    localStorage.getItem.mockReturnValue(JSON.stringify(cachedData));
    const articles = await fetchAllFeeds({ hoursLimit: 1 });
    expect(articles.length).toBe(30);
  });
});
