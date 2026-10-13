import { test, expect } from '@playwright/test';
import { createKimpay, dismissInstallPrompt, switchIdentity } from './test-utils';

test.describe('Balance & Debts', () => {

  test.beforeEach(async ({ page }) => {
    await createKimpay(page, 'Balance Test', 'Payer');
    await dismissInstallPrompt(page);
  });

  test('Shows balanced state when no expenses', async ({ page }) => {
    // Add another participant (required to have someone to owe/be owed by)
    const url = page.url();
    await page.goto(url.replace(/\/?$/, '/members'));
    await page.getByPlaceholder('New name').fill('Other');
    await page.getByRole('button', { name: /add/i }).click();
    await expect(page.getByText('Other', { exact: true })).toBeVisible();

    // Navigate to balance page
    await page.getByRole('navigation').getByRole('link', { name: /balance/i }).click();

    // With no expenses, should show "No expenses yet" empty state
    await expect(page.getByText(/no expenses/i)).toBeVisible({ timeout: 5000 });
  });

  test('Shows correct debt after shared expense', async ({ page }) => {
    // 1. First add another participant BEFORE creating expense
    const url = page.url();
    await page.goto(url.replace(/\/?$/, '/members'));

    await page.getByPlaceholder('New name').fill('Debtor');
    await page.getByRole('button', { name: /add/i }).click();
    await expect(page.getByText('Debtor', { exact: true })).toBeVisible();

    // 2. Add expense paid by Payer (me), shared with both
    await page.getByRole('link', { name: /expenses/i }).click();
    await page.getByRole('link', { name: /add expense/i }).click();

    await page.getByPlaceholder('What was it for?').fill('Test Expense');
    await page.getByPlaceholder('0.00').fill('100');

    // By default all participants should be selected
    await page.getByRole('button', { name: /save|enregistrer/i }).first().click();
    await expect(page.getByText('Test Expense')).toBeVisible();

    // 3. Go to balance
    await page.getByRole('navigation').getByRole('link', { name: /balance/i }).click();

    // 4. Verify I am owed money (100/2 = 50) - look for transaction showing debt
    // Wait for balance to load and show debt summary
    await page.waitForTimeout(500);
    await expect(page.getByText('You are owed')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/50[.,]00/).first()).toBeVisible();
  });

  test('Shows debt when I owe money', async ({ page }) => {
    // 1. Add another participant
    const url = page.url();
    await page.goto(url.replace(/\/?$/, '/members'));

    await page.getByPlaceholder('New name').fill('Rich Person');
    await page.getByRole('button', { name: /add/i }).click();
    await expect(page.getByText('Rich Person', { exact: true })).toBeVisible();

    // 2. Switch identity to Rich Person so they pay
    await switchIdentity(page, 'Rich Person');

    // 3. Add expense paid by Rich Person (now me), shared with both
    await page.getByRole('link', { name: /expenses/i }).click();
    await page.getByRole('link', { name: /add expense/i }).click();

    await page.getByPlaceholder('What was it for?').fill('Luxury Item');
    await page.getByPlaceholder('0.00').fill('200');

    await page.getByRole('button', { name: /save|enregistrer/i }).first().click();

    // 4. Switch back to Payer to see debt
    await switchIdentity(page, 'Payer');

    // 5. Go to balance
    await page.getByRole('navigation').getByRole('link', { name: /balance/i }).click();
    await expect(page).toHaveURL(/\/balance/);

    // 6. Verify I owe money (200/2 = 100) - look for the specific "You owe" text
    await expect(page.getByText('You owe')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/100[.,]00/).first()).toBeVisible();
  });

  test('Records part of what is owed', async ({ page }) => {
    const url = page.url();
    await page.goto(url.replace(/\/?$/, '/members'));
    await page.getByPlaceholder('New name').fill('Debtor');
    await page.getByRole('button', { name: /add/i }).click();
    await expect(page.getByText('Debtor', { exact: true })).toBeVisible();

    await page.getByRole('link', { name: /expenses/i }).click();
    await page.getByRole('link', { name: /add expense/i }).click();
    await page.getByPlaceholder('What was it for?').fill('Dinner');
    await page.getByPlaceholder('0.00').fill('100');
    await page.getByRole('button', { name: /save expense/i }).first().click();
    await expect(page.getByText('Dinner')).toBeVisible();

    // Debtor owes 50 and pays 20 of it: 30 left.
    await page.getByRole('navigation').getByRole('link', { name: /balance/i }).click();
    await page.getByRole('button', { name: 'Mark as settled' }).click();
    const sheet = page.getByRole('dialog');
    const amount = sheet.getByLabel('Amount paid');
    await expect(amount).toHaveValue('50');
    await amount.fill('80');
    await expect(sheet.getByText('At most €50.00, the amount due.')).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Confirm Payment' })).toBeDisabled();
    await amount.fill('20');
    await expect(sheet.getByText('€30.00 will remain to be settled.')).toBeVisible();
    await sheet.getByRole('button', { name: 'Confirm Payment' }).click();
    await expect(sheet).toBeHidden();

    await expect(page.getByText('You are owed')).toBeVisible();
    await expect(page.getByText('€30.00').first()).toBeVisible();
  });

});
