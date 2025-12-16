import { test, expect } from '@playwright/test';
import { createKimpay, dismissInstallPrompt } from './test-utils';

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
    // Click on expense to expand accordion
    await page.getByText('Original Expense').click();
    
    // Wait for accordion to expand - use exact match to avoid matching header menu
    const editBtn = page.getByRole('button', { name: 'Edit', exact: true });
    await expect(editBtn).toBeVisible();
    await editBtn.click();
    
    // Should navigate to edit page
    await expect(page).toHaveURL(/\/edit\//);
    
    // Modify values
    await page.getByPlaceholder('What was it for?').clear();
    await page.getByPlaceholder('What was it for?').fill('Modified Expense');
    await page.getByPlaceholder('0.00').clear();
    await page.getByPlaceholder('0.00').fill('99');
    
    // Save - look for update button
    await page.getByRole('button', { name: /update|modifier|save|enregistrer/i }).first().click();
    
    // Verify changes
    await expect(page.getByText('Modified Expense')).toBeVisible();
    await expect(page.getByText('99')).toBeVisible();
    await expect(page.getByText('Original Expense')).not.toBeVisible();
  });

  test('Delete expense with confirmation', async ({ page }) => {
    // Click on expense to expand accordion
    await page.getByText('Original Expense').click();
    
    // Wait for accordion to expand - use exact match
    const deleteBtn = page.getByRole('button', { name: 'Delete', exact: true });
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();
    
    // Confirm deletion in modal
    const confirmBtn = page.getByRole('dialog').getByRole('button', { name: /confirm|delete|supprimer/i });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();
    
    // Expense should be gone
    await expect(page.getByText('Original Expense')).not.toBeVisible();
  });

  test('View expense details in accordion', async ({ page }) => {
    // Click on expense to expand accordion
    await page.getByText('Original Expense').click();
    
    // Should show details in expanded state (not navigate away)
    await expect(page.getByText('Date:')).toBeVisible();
    // Use exact match for buttons inside the accordion
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeVisible();
    
    // Click again to collapse
    await page.getByText('Original Expense').click();
    
    // Details should be hidden
    await expect(page.getByText('Date:')).not.toBeVisible();
  });

});
