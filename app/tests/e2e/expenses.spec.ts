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
    await expect(page.getByText(/25[.,]00/).first()).toBeVisible();
  });

  test('Validation: Save disabled without required fields', async ({ page }) => {
    await page.getByRole('link', { name: /add expense/i }).click();
    // Verify Save disabled, and why
    const saveBtn = page.getByRole('button', { name: /save|enregistrer/i }).first(); // Might match FAB too, filtering or using first is fine as they should both work
    await expect(saveBtn).toBeDisabled();
    await expect(page.getByText('Missing: amount, description')).toBeVisible();

    // Fill required
    await page.getByPlaceholder('What was it for?').fill('Groceries');
    await expect(page.getByText('Missing: amount')).toBeVisible();
    await page.getByPlaceholder('0.00').fill('50');

    // Should be enabled now (assuming payer/involved defaults are set)
    await expect(saveBtn).toBeEnabled();
    await expect(page.getByText(/^Missing:/)).toBeHidden();
  });

  test('Empty group offers to add, scan and invite', async ({ page }) => {
    await expect(page.getByText('No expenses yet')).toBeVisible();
    await expect(page.getByText('Nobody else here yet')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Add an expense' })).toBeVisible();

    // Scanning needs an account: a guest is told how to get one.
    await page.getByRole('main').getByRole('button', { name: 'Scan a receipt' }).click();
    await expect(page.getByRole('dialog', { name: 'Sign Up' }).getByText(/free account to scan your receipts/)).toBeVisible();
  });

  test('The new expense form invites to scan a receipt', async ({ page }) => {
    await page.getByRole('link', { name: /add expense/i }).click();
    const card = page.getByRole('button', { name: /scan a receipt/i });
    await expect(card).toBeVisible();

    // Typing by hand: the card leaves room, the top bar keeps the scanner.
    await page.getByPlaceholder('0.00').fill('12');
    await expect(card).toBeHidden();
    await expect(page.getByRole('button', { name: 'Scan', exact: true })).toBeVisible();
  });

  test('Finds an emoji by typing its name', async ({ page }) => {
    await page.getByRole('link', { name: /add expense/i }).click();
    await page.getByRole('button', { name: 'Choose an emoji' }).click();

    const picker = page.getByRole('dialog', { name: 'Choose an emoji' });
    await picker.getByRole('searchbox').fill('pizz');
    await picker.getByRole('button', { name: '🍕' }).click();
    await expect(picker).toBeHidden();
    await expect(page.getByRole('button', { name: 'Choose an emoji' })).toHaveText('🍕');

    // Nothing found: said so.
    await page.getByRole('button', { name: 'Choose an emoji' }).click();
    await picker.getByRole('searchbox').fill('zzzz');
    await expect(picker.getByText('No emoji for “zzzz”')).toBeVisible();
  });

  test('The payer is one line, unfolded on demand', async ({ page }) => {
    await page.getByRole('link', { name: /add expense/i }).click();
    await page.getByRole('button', { name: /spender.*change/i }).click();
    await expect(page.getByRole('group', { name: 'Paid by' }).getByRole('button', { name: 'Spender' })).toHaveAttribute('aria-pressed', 'true');
  });

  // Reimbursement flow might require 2 participants to be meaningful,
  // but we can check the UI toggle if present or just the type of expense.
  // For now, let's stick to basic expense.

  test('Balance Verification: You are owed money', async ({ page }) => {
    // 1. Add another participant so we can share costs
    const url = page.url();
    await page.goto(url.replace(/\/?$/, '/members'));

    await page.getByPlaceholder('New name').fill('Alice');
    await page.getByRole('button', { name: /add/i }).click();
    await expect(page.getByText('Alice', { exact: true })).toBeVisible();

    // 2. Go back to Add Expense using explicit navigation to be safe
    // Instead of forcing a reload with page.goto which can timeout on mobile, we can use the main nav.
    await page.getByRole('navigation').getByRole('link', { name: 'Expenses' }).click(); // 'nav.expenses' translates to 'Expenses'
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
    // Each line tells what it changes for me: I advanced Alice's half.
    await expect(page.getByText('you lent €25.00')).toBeVisible();

    // 4. Go to Balance Page using UI link
    await page.getByRole('navigation').getByRole('link', { name: /balance/i }).click();

    // 5. Verify "You are owed" (balance card, then the payment and balances)
    await expect(page.getByText('You are owed')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('25.00').first()).toBeVisible();
  });

});
