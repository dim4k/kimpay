import { test, expect } from '@playwright/test';
import { createKimpay, dismissInstallPrompt } from './test-utils';

test.describe('Balance & Debts', () => {

  test.beforeEach(async ({ page }) => {
    await createKimpay(page, 'Balance Test', 'Payer');
    await dismissInstallPrompt(page);
  });

  test('Shows balanced state when no expenses', async ({ page }) => {
    // Add another participant (required to have someone to owe/be owed by)
    const url = page.url();
    await page.goto(url.replace(/\/?$/, '/settings'));
    await page.getByPlaceholder('New name').fill('Other');
    await page.getByRole('button', { name: /add/i }).click();
    await expect(page.getByText('Other')).toBeVisible();

    // Navigate to balance page
    await page.getByRole('link', { name: /balance/i }).click();
    
    // With no expenses, should show "No expenses yet" empty state
    await expect(page.getByText(/no expenses/i)).toBeVisible({ timeout: 5000 });
  });

  test('Shows correct debt after shared expense', async ({ page }) => {
    // 1. First add another participant BEFORE creating expense
    const url = page.url();
    const settingsUrl = url.replace(/\/?$/, '/settings');
    await page.goto(settingsUrl);
    
    await page.getByPlaceholder('New name').fill('Debtor');
    await page.getByRole('button', { name: /add/i }).click();
    await expect(page.getByText('Debtor')).toBeVisible();

    // 2. Add expense paid by Payer (me), shared with both
    await page.getByRole('link', { name: /expenses/i }).click();
    await page.getByRole('link', { name: /add expense/i }).click();
    
    await page.getByPlaceholder('What was it for?').fill('Test Expense');
    await page.getByPlaceholder('0.00').fill('100');
    
    // By default all participants should be selected
    await page.getByRole('button', { name: /save|enregistrer/i }).first().click();
    await expect(page.getByText('Test Expense')).toBeVisible();

    // 3. Go to balance
    await page.getByRole('link', { name: /balance/i }).click();

    // 4. Verify I am owed money (100/2 = 50) - look for transaction showing debt
    // Wait for balance to load and show debt summary
    await page.waitForTimeout(500);
    await expect(page.getByText('50')).toBeVisible({ timeout: 10000 });
  });

  test('Shows debt when I owe money', async ({ page }) => {
    // 1. Add another participant
    const url = page.url();
    await page.goto(url.replace(/\/?$/, '/settings'));
    
    await page.getByPlaceholder('New name').fill('Rich Person');
    await page.getByRole('button', { name: /add/i }).click();
    await expect(page.getByText('Rich Person')).toBeVisible();

    // 2. Switch identity to Rich Person so they pay
    const switchBtn = page.getByRole('button', { name: /switch identity|changer/i });
    await switchBtn.click();
    await page.getByRole('dialog').getByRole('button', { name: /save|enregistrer/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    // 3. Add expense paid by Rich Person (now me), shared with both
    await page.getByRole('link', { name: /expenses/i }).click();
    await page.getByRole('link', { name: /add expense/i }).click();
    
    await page.getByPlaceholder('What was it for?').fill('Luxury Item');
    await page.getByPlaceholder('0.00').fill('200');
    
    await page.getByRole('button', { name: /save|enregistrer/i }).first().click();

    // 4. Switch back to Payer to see debt
    await page.goto(url.replace(/\/?$/, '/settings'));
    const payerRow = page.locator('.group', { has: page.getByText('Payer') });
    await payerRow.getByRole('button', { name: /switch identity|changer/i }).click();
    await page.getByRole('dialog').getByRole('button', { name: /save|enregistrer/i }).click();

    // 5. Go to balance
    await page.getByRole('link', { name: /balance/i }).click();

    // 6. Verify I owe money (200/2 = 100) - look for the specific "YOU OWE" text
    await expect(page.getByText('YOU OWE')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('100')).toBeVisible();
  });

});
