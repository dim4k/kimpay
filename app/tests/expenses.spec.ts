import { test, expect } from '@playwright/test';
import { createKimpay, dismissInstallPrompt } from './test-utils';

test.describe('Expense Management', () => {

  test.beforeEach(async ({ page }) => {
    await createKimpay(page, 'Expense Test Group', 'Spender');
    await dismissInstallPrompt(page);
  });

  test('Add Expense with simple flow', async ({ page }) => {
    // Navigate to Add Expense
    await page.getByRole('link', { name: /add expense/i }).click();
    await expect(page).toHaveURL(/.*\/add/);

    // Fill Form
    await page.getByPlaceholder('What was it for?').fill('Pizza');
    await page.getByPlaceholder('0.00').fill('25.00');
    
    // Save
    await page.getByRole('button', { name: /save|enregistrer/i }).first().click();

    // Verify
    await expect(page).toHaveURL(/\/?$/); // Back to dashboard (regex might need adjust if having params)
    await expect(page.getByText('Pizza')).toBeVisible();
    await expect(page.getByText('25.00')).toBeVisible();
  });

  test('Validation: Save disabled without required fields', async ({ page }) => {
    await page.getByRole('link', { name: /add expense/i }).click();
    // Verify Save disabled
    const saveBtn = page.getByRole('button', { name: /save|enregistrer/i }).first(); // Might match FAB too, filtering or using first is fine as they should both work
    await expect(saveBtn).toBeDisabled();
    
    // Fill required
    await page.getByPlaceholder('What was it for?').fill('Groceries');
    await page.getByPlaceholder('0.00').fill('50');
    
    // Should be enabled now (assuming payer/involved defaults are set)
    await expect(saveBtn).toBeEnabled();
  });

  // Reimbursement flow might require 2 participants to be meaningful, 
  // but we can check the UI toggle if present or just the type of expense.
  // For now, let's stick to basic expense.

  test('Balance Verification: You are owed money', async ({ page }) => {
    // 1. Add another participant so we can share costs
    const url = page.url();
    const settingsUrl = url.endsWith('/') ? `${url}settings` : `${url}/settings`;
    await page.goto(settingsUrl);
    
    await page.getByPlaceholder('New name').fill('Alice');
    await page.getByRole('button', { name: /add/i }).click(); 
    await expect(page.getByText('Alice')).toBeVisible();

    // 2. Go back to Add Expense using explicit navigation to be safe
    // Instead of forcing a reload with page.goto which can timeout on mobile, we can use the main nav.
    await page.getByRole('link', { name: 'Expenses' }).click(); // 'nav.expenses' translates to 'Expenses'
    await expect(page).toHaveURL(/\/?$/); // Verify we are on expenses page
    await page.getByRole('link', { name: /add expense/i }).click();

    // 3. Add Expense paid by Me (implied) for Everyone (implied)
    await page.getByPlaceholder('What was it for?').fill('Shared Dinner');
    await page.getByPlaceholder('0.00').fill('50.00'); // I pay 50, shared by 2 (25 each)
    
    // Ensure save button is clickable
    await expect(page.getByRole('button', { name: /save|enregistrer/i }).first()).toBeEnabled();
    await page.getByRole('button', { name: /save|enregistrer/i }).first().click();

    // Verify we are back on dashboard and expense is visible
    await expect(page).toHaveURL(/\/?$/); 
    await expect(page.getByText('Shared Dinner')).toBeVisible();

    // 4. Go to Balance Page using UI link
    await page.getByRole('link', { name: /balance/i }).click();

    // 5. Verify "Owed to you"
    // Text in i18n is "YOU ARE OWED"
    await expect(page.getByText('YOU ARE OWED', { exact: false })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('25.00')).toBeVisible();
  });

});
