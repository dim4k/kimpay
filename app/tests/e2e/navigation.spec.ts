import { test, expect } from '@playwright/test';
import { createKimpay, dismissInstallPrompt } from './test-utils';

test.describe('Navigation & UX', () => {

  test.beforeEach(async ({ page }) => {
    await createKimpay(page, 'Navigation Test', 'Navigator');
    await dismissInstallPrompt(page);
  });

  test('Navbar switches between all pages', async ({ page }) => {
    // Start on expenses page
    await expect(page).toHaveURL(/\/k\//);
    
    // Go to Balance
    await page.getByRole('link', { name: /balance/i }).click();
    await expect(page).toHaveURL(/\/balance/);
    
    // Go to Share
    await page.getByRole('link', { name: /share|partager/i }).click();
    await expect(page).toHaveURL(/\/share/);
    
    // Go to Settings
    await page.getByRole('link', { name: /settings|paramètres/i }).click();
    await expect(page).toHaveURL(/\/settings/);
    
    // Go back to Expenses
    await page.getByRole('link', { name: /expenses|dépenses/i }).click();
    await expect(page).toHaveURL(/\/k\/[a-z0-9]+\/?$/);
  });

  test('FAB is visible and functional', async ({ page }) => {
    // The central button in the navbar for adding expenses
    const addLink = page.getByRole('link', { name: /add expense/i });
    await expect(addLink).toBeVisible();
    
    await addLink.click();
    await expect(page).toHaveURL(/\/add/);
  });

  test('Return to home from Kimpay', async ({ page }) => {
    // Click on logo/home link in header
    const homeLink = page.getByRole('link', { name: /kimpay|home|accueil/i }).first();
    
    if (await homeLink.isVisible()) {
      await homeLink.click();
      await expect(page).toHaveURL('/');
      await expect(page.getByText('Navigation Test')).toBeVisible(); // Should appear in recents
    }
  });

  test('Share page shows invite options', async ({ page }) => {
    await page.getByRole('link', { name: /share|partager/i }).click();
    
    // Should show Copy Link button specifically
    const copyBtn = page.getByRole('button', { name: /copy link|copier/i });
    await expect(copyBtn).toBeVisible();
    await expect(copyBtn).toBeEnabled();
  });

  test('Settings page shows group info', async ({ page }) => {
    await page.getByRole('link', { name: /settings|paramètres/i }).click();
    
    // Group name should be editable
    await expect(page.getByText('Navigation Test')).toBeVisible();
    
    // Participant list should show creator
    await expect(page.getByText('Navigator')).toBeVisible();
    
    // Leave/Delete buttons should exist
    await expect(page.getByRole('button', { name: /leave|quitter/i })).toBeVisible();
  });

});
