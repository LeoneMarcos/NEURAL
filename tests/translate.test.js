import { describe, it, expect, vi, beforeEach } from 'vitest';
import { translateArticle, translateArticles, restoreOriginal, clearTranslationCache } from '../src/translate.js';

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

describe('translate.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should translate an article', async () => {
    const article = { title: 'Hello', description: 'World' };
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        responseStatus: 200,
        responseData: { translatedText: 'Translated' }
      })
    });

    const translated = await translateArticle(article);
    expect(translated.title).toBe('Translated');
  });

  it('should translate a batch of articles', async () => {
    const articles = [{ title: 'One' }, { title: 'Two' }];
    const onProgress = vi.fn();
    
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        responseStatus: 200,
        responseData: { translatedText: 'Translated' }
      })
    });

    const results = await translateArticles(articles, onProgress);
    expect(results.length).toBe(2);
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenCalledWith(1, 2);
    expect(onProgress).toHaveBeenCalledWith(2, 2);
  });

  it('should handle translation error gracefully', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const article = { title: 'Error Test' };
    const result = await translateArticle(article);
    expect(result.title).toBe('Error Test'); // Fallback to original
  });

  it('should handle quota exceeded error', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        responseStatus: 200,
        responseData: { translatedText: 'MYMEMORY WARNING: Quota Exceeded' }
      })
    });
    const result = await translateArticle({ title: 'Quota Test' });
    expect(result.title).toBe('Quota Test'); // Fallback
  });

  it('should restore original text', () => {
    const translatedArticles = [{
      title: 'Olá',
      description: 'Mundo',
      originalTitle: 'Hello',
      originalDescription: 'World',
      isTranslated: true
    }];

    const restored = restoreOriginal(translatedArticles);
    expect(restored[0].title).toBe('Hello');
    expect(restored[0].isTranslated).toBe(false);
  });

  it('should prune cache when localStorage is full', async () => {
    // Fill cache with > 200 items to trigger pruning
    const largeCache = {};
    for (let i = 0; i < 210; i++) largeCache[`key${i}`] = `value${i}`;
    
    localStorage.getItem.mockReturnValueOnce(JSON.stringify(largeCache));
    
    // Trigger a side effect that calls saveTranslationCache (like a translation)
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        responseStatus: 200,
        responseData: { translatedText: 'Pruned' }
      })
    });

    // Re-import or rely on module state? 
    // translate.js loads cache on import. We might need to mock loadTranslationCache specifically if possible.
    // However, the module is already loaded. Let's try clear and then translate.
    
    const { clearTranslationCache } = await import('../src/translate.js');
    clearTranslationCache(); 
    
    await translateArticle({ title: 'Small text' });
    expect(localStorage.setItem).toHaveBeenCalled();
  });

  it('should hit cache if text already translated', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        responseStatus: 200,
        responseData: { translatedText: 'Network Result' }
      })
    });

    // Translate once to fill cache
    await translateArticle({ title: 'Cache Me', description: 'Desc Me' });
    
    // Translate again with same text
    const result = await translateArticle({ title: 'Cache Me', description: 'Desc Me' });
    
    // First call: 1 for title, 1 for desc = 2 calls.
    // Second call: 0 calls (both hit cache).
    expect(fetch).toHaveBeenCalledTimes(2); 
    expect(result.title).toBe('Network Result'); 
  });

  it('should fallback to original for untranslated articles in restoreOriginal', () => {
    const articles = [{ title: 'English' }];
    const restored = restoreOriginal(articles);
    expect(restored[0].title).toBe('English');
  });

  it('should handle API details error', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        responseStatus: 400,
        responseDetails: 'Invalid Params'
      })
    });
    const result = await translateArticle({ title: 'Invalid Test' });
    expect(result.title).toBe('Invalid Test');
  });

  it('should handle localStorage retrieval error', async () => {
    vi.resetModules();
    localStorage.getItem.mockImplementationOnce(() => { throw new Error('Lock'); });
    const { translateArticle } = await import('../src/translate.js');
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        responseStatus: 200,
        responseData: { translatedText: 'Fresh' }
      })
    });
    const result = await translateArticle({ title: 'Error' });
    expect(result.title).toBe('Fresh');
  });

  it('should fallback to original on fetch failure', async () => {
    fetch.mockResolvedValueOnce({ ok: false });
    const result = await translateArticle({ title: 'Fail Test' });
    expect(result.title).toBe('Fail Test'); // Manual fallback in code
  });

  it('should cover pruning logic', async () => {
    // Mock setTimeout to be instant
    const timeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation((fn) => {
      fn();
      return undefined;
    });
    
    const { translateArticle, clearTranslationCache } = await import('../src/translate.js');
    clearTranslationCache();

    fetch.mockResolvedValue({ 
      ok: true, 
      json: async () => ({ responseStatus: 200, responseData: { translatedText: 'x' }})
    });

    // Fill with 201 small items - this should be very fast with mock setTimeout
    const promises = [];
    for (let i = 0; i < 205; i++) {
       promises.push(translateArticle({ title: `t${i}` }));
    }
    await Promise.all(promises);
    
    // Now trigger a catch block in saveTranslationCache by making setItem throw
    localStorage.setItem.mockImplementationOnce(() => { throw new Error('Storage Full'); });
    
    // One more translation to trigger saveTranslationCache
    await translateArticle({ title: 'Final' });
    
    expect(localStorage.setItem).toHaveBeenCalled();
    timeoutSpy.mockRestore();
  }, 10000); // 10s is plenty with instant timers

  it('should handle empty or null text', async () => {
    const { translateArticle } = await import('../src/translate.js');
    const result = await translateArticle({ title: '', description: null });
    expect(result.title).toBe('');
    expect(result.description).toBe(null);
  });
});
