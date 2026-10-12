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
    await page.getByRole('navigation').getByRole('link', { name: /balance/i }).click();
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
    // The logo in the header leads home
    await page.getByRole('link', { name: 'My Kimpays' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByText('Navigation Test')).toBeVisible(); // Should appear in recents
  });

  test('Group switcher in the header lists the groups', async ({ page }) => {
    await page.getByRole('button', { name: /Navigation Test/ }).click();
    await expect(page.getByRole('link', { name: /Navigation Test/ })).toHaveAttribute('aria-current', 'page');

    await page.getByRole('link', { name: 'My Kimpays' }).last().click();
    await expect(page).toHaveURL('/');
  });

  test('Tabs do not pile up in the history', async ({ page }) => {
    const tabs = page.getByRole('navigation');
    await tabs.getByRole('link', { name: /balance/i }).click();
    await expect(page).toHaveURL(/\/balance/);
    await tabs.getByRole('link', { name: /share/i }).click();
    await expect(page).toHaveURL(/\/share/);

    // Back leaves the group instead of replaying the tabs
    await page.goBack();
    await expect(page).toHaveURL('/');
  });

  test('Closing the expense form returns to the tab it was opened from', async ({ page }) => {
    await page.getByRole('navigation').getByRole('link', { name: /balance/i }).click();
    await expect(page).toHaveURL(/\/balance/);

    await page.getByRole('link', { name: /add expense/i }).click();
    await expect(page).toHaveURL(/\/add/);
    await page.getByRole('link', { name: 'Close' }).click();
    await expect(page).toHaveURL(/\/balance/);
  });

  test('Bottom sheets close with their handle', async ({ page }) => {
    test.skip(!test.info().project.use.isMobile, 'Sheets only slide up from the bottom on phones');
    const profile = page.getByRole('dialog', { name: 'Profile' });
    const handle = profile.getByRole('button', { name: 'Close' });

    // Dragged down
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(profile).toBeVisible();
    // hover() waits for the sheet to finish sliding in.
    await handle.hover();
    const box = (await handle.boundingBox())!;
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 200, { steps: 10 });
    await page.mouse.up();
    await expect(profile).toBeHidden();

    // Tapped
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(profile).toBeVisible();
    await handle.click();
    await expect(profile).toBeHidden();
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
    
    // Group name should be shown (header and group card), and editable
    await expect(page.getByText('Navigation Test').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
    
    // Participant list should show the creator as the current identity
    // (scoped: the header also shows the identity name)
    await expect(page.locator('[data-is-me="true"]').getByText('Navigator')).toBeVisible();
    
    // Leave/Delete buttons should exist
    await expect(page.getByRole('button', { name: /leave|quitter/i })).toBeVisible();
  });

});
