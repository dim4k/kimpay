import { test, expect } from '@playwright/test';
import { createKimpay, dismissInstallPrompt, expenseSheet } from './test-utils';

test.describe('Expense CRUD Operations', () => {

  test.beforeEach(async ({ page }) => {
    await createKimpay(page, 'CRUD Test', 'Editor');
    await dismissInstallPrompt(page);
    
    // Create an initial expense to work with
    await page.getByRole('link', { name: /add expense/i }).click();
    await page.getByPlaceholder('What was it for?').fill('Original Expense');
    await page.getByPlaceholder('0.00').fill('42');
    await page.getByRole('button', { name: /save|enregistrer/i }).first().click();
    await expect(page.getByText('Original Expense')).toBeVisible();
  });

  test('Edit existing expense', async ({ page }) => {
    // The line opens its sheet, where the expense is changed
    await page.getByText('Original Expense').click();
    await expect(page).toHaveURL(/\/edit\//);

    // Modify values
    await page.getByPlaceholder('What was it for?').clear();
    await page.getByPlaceholder('What was it for?').fill('Modified Expense');
    await page.getByPlaceholder('0.00').clear();
    await page.getByPlaceholder('0.00').fill('99');

    // Save - look for update button
    await page.getByRole('button', { name: /update|mettre à jour/i }).first().click();

    // Verify changes
    await expect(page.getByText('Modified Expense')).toBeVisible();
    await expect(page.getByText(/99[.,]00/).first()).toBeVisible();
    await expect(page.getByText('Original Expense')).not.toBeVisible();
  });

  test('Delete expense with confirmation', async ({ page }) => {
    // Delete is at the bottom of the expense's sheet
    await page.getByText('Original Expense').click();
    const deleteBtn = expenseSheet(page).getByRole('button', { name: 'Delete', exact: true });
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Confirm deletion in modal
    await page.getByRole('dialog', { name: 'Delete expense?' }).getByRole('button', { name: 'Delete' }).click();

    // Expense should be gone
    await expect(page.getByText('Original Expense')).not.toBeVisible();
  });

});
