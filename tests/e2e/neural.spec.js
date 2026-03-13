import { test, expect } from '@playwright/test';

test.describe('NEURAL App', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the local dev server
    await page.goto('http://localhost:5173');
  });

  test('should load the application title', async ({ page }) => {
    await expect(page).toHaveTitle(/NEURAL/);
    await expect(page.locator('h1')).toContainText('NEURAL');
  });

  test('should toggle translation mode', async ({ page }) => {
    const translateBtn = page.locator('#translate-toggle');
    await expect(translateBtn).toBeVisible();
    
    // Check initial state (should be English if not toggled)
    const firstArticle = page.locator('.article-card').first();
    await expect(firstArticle).toBeVisible();
    
    // Toggle to Portuguese
    await translateBtn.click();
    
    // Wait for translation process (overlay or progress)
    // In our app, it might show a loading state
    await page.waitForTimeout(2000); // Give it some time to "translate" (mocked or real)
    
    // Verify it says "Traduzido" or similar if we have such indicator
    // Or check if the button text changed
    await expect(translateBtn).toContainText(/Original/i);
  });

  test('should filter articles by source', async ({ page }) => {
    const filterBtn = page.locator('.filter-btn').first();
    const sourceName = await filterBtn.innerText();
    
    await filterBtn.click();
    
    // Verify all visible articles belong to this source
    const articles = page.locator('.article-card');
    const count = await articles.count();
    
    for (let i = 0; i < count; i++) {
      const articleSource = await articles.nth(i).locator('.source-badge').innerText();
      expect(articleSource.toLowerCase()).toContain(sourceName.toLowerCase());
    }
  });
});
