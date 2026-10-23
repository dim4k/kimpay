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
    // A new Kimpay: its first steps in one card.
    await expect(page.getByRole('region', { name: 'Getting started' })).toBeVisible();
    await expect(page.getByRole('heading', { name: "Who's in?" })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Add an expense' })).toBeVisible();

    // Scanning needs an account: a guest is told how to get one.
    await page.getByRole('main').getByRole('button', { name: 'Scan a receipt' }).click();
    await expect(page.getByRole('dialog', { name: 'Sign up' }).getByText(/free account to scan your receipts/)).toBeVisible();
  });

  test('The new expense form offers to scan a receipt', async ({ page }) => {
    await page.getByRole('link', { name: /add expense/i }).click();
    await expect(page.getByRole('button', { name: 'Scan', exact: true })).toBeVisible();

    // Not for money received.
    await page.getByRole('radio', { name: 'Money in' }).click();
    await expect(page.getByRole('button', { name: 'Scan', exact: true })).toBeHidden();
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

  test('The bar shrinks to the day in view when the list scrolls', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Computers have the height for the full bar');
    for (let i = 1; i <= 10; i++) {
      await page.getByRole('link', { name: /add expense/i }).click();
      await page.getByPlaceholder('What was it for?').fill(`Item ${i}`);
      await page.getByPlaceholder('0.00').fill(String(i * 10));
      await page.getByRole('button', { name: /save expense/i }).click();
      await expect(page.getByText(`Item ${i}`, { exact: true })).toBeVisible();
    }

    // Scrolled down: the search field gives way to the day and its amount.
    await page.locator('main').evaluate((main) => main.scrollTo(0, main.scrollHeight));
    const search = page.getByRole('button', { name: 'Search' });
    await expect(search).toBeVisible();
    await expect(page.getByPlaceholder('Search')).toBeHidden();
    await expect(page.getByRole('radio', { name: 'For me' })).toBeVisible();

    // The search button brings the field back, ready to type.
    await search.click();
    await expect(page.getByPlaceholder('Search')).toBeFocused();
  });

  test('The payer is one line, changed in its panel', async ({ page }) => {
    await page.getByRole('link', { name: /add expense/i }).click();
    const payer = page.getByRole('button', { name: /^paid by spender/i });
    await payer.click();
    const choice = page.getByRole('group', { name: 'Paid by' }).getByRole('button', { name: 'Spender' });
    await expect(choice).toHaveAttribute('aria-pressed', 'true');

    // One payer: picking them closes the panel.
    await choice.click();
    await expect(payer).toBeVisible();
  });

  // Reimbursement flow might require 2 participants to be meaningful,
  // but we can check the UI toggle if present or just the type of expense.
  // For now, let's stick to basic expense.

  test('Balance Verification: You are owed money', async ({ page, isMobile }) => {
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
    // "For me" (default): each line tells what it changes for me, I advanced Alice's half.
    const line = page.locator('.expense-item', { hasText: 'Shared Dinner' });
    await expect(line.getByText('You paid €50.00')).toBeVisible();
    await expect(line.getByText('owed to you')).toBeVisible();
    await expect(line.getByText('€25.00', { exact: true })).toBeVisible();

    // "Total": who paid and the amount, remembered on this device.
    await page.getByRole('radio', { name: 'Total' }).click();
    await expect(line.getByText('€50.00', { exact: true })).toBeVisible();
    await expect(line.getByText('owed to you')).toBeHidden();
    // I am one of the 2 people: the count is a pill (computers: "Everyone", in its column).
    await expect(line.locator('.rounded-full:visible', { hasText: isMobile ? '2 people' : 'Everyone' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Total' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('radio', { name: 'For me' }).click();

    // 4. Go to Balance Page using UI link
    await page.getByRole('navigation').getByRole('link', { name: /balance/i }).click();

    // 5. Verify "You are owed" (balance card, then the payment and balances)
    await expect(page.getByText('You are owed')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('25.00').first()).toBeVisible();
  });

});
