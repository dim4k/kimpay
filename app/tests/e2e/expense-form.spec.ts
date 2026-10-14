import { test, expect } from '@playwright/test';
import { closeExpenseSheet, createKimpay, dismissInstallPrompt, expenseSheet } from './test-utils';

test.describe('Expense form', () => {
    test.beforeEach(async ({ page }) => {
        await createKimpay(page, 'Form Test', 'Alice');
        await dismissInstallPrompt(page);
        await page.getByRole('link', { name: /add expense/i }).click();
        await expect(page).toHaveURL(/\/add$/);
        await expect(expenseSheet(page)).toBeVisible();
    });

    test('the icon follows the description until picked', async ({ page }) => {
        const icon = page.getByRole('button', { name: 'Choose an emoji' });
        await page.getByPlaceholder('What was it for?').fill('Pizza night');
        await expect(icon).toHaveText('🍕');
        await page.getByPlaceholder('What was it for?').fill('Train tickets');
        await expect(icon).toHaveText('🚆');
    });

    test('each setting is a line of the summary, changed in its panel', async ({ page }) => {
        await page.getByPlaceholder('0.00').fill('30');
        const summary = page.getByRole('button', { name: /split equally/i });
        await expect(summary).toBeVisible();
        await summary.click();
        await expect(page.getByRole('radio', { name: 'Amounts' })).toBeVisible();
        await expect(expenseSheet(page).getByRole('heading', { name: 'Split' })).toBeVisible();

        // A panel has no footer (not the expense's Save): its chevron goes back.
        const sheet = expenseSheet(page);
        await expect(sheet.getByRole('button', { name: /save expense/i })).toHaveCount(0);
        await sheet.getByRole('button', { name: 'Back' }).click();
        await expect(summary).toBeVisible();
        await expect(sheet.getByRole('button', { name: /save expense/i })).toBeVisible();

        // Back closes the panel, not the sheet.
        await summary.click();
        await page.goBack();
        await expect(summary).toBeVisible();
        await expect(page).toHaveURL(/\/add$/);
    });

    test('the date is picked in its panel, which closes once picked', async ({ page }) => {
        await expenseSheet(page).getByRole('button', { name: /^date/i }).click();
        const calendar = page.getByRole('group', { name: 'Date' });
        // Each day is named by its full date ("Tuesday, September 1, 2026"): the 1st shown.
        await calendar.locator('button[data-iso$="-01"]').first().click();
        await expect(calendar).toBeHidden();
        await expect(expenseSheet(page).getByRole('button', { name: /^date/i })).toBeVisible();
    });

    test('amounts of a split accept a decimal comma', async ({ page }) => {
        await page.getByPlaceholder('0.00').fill('30');
        await page.getByRole('button', { name: /split equally/i }).click();
        await page.getByRole('radio', { name: 'Amounts' }).click();
        const field = page.getByLabel('Share of Alice');
        await field.fill('10,5');
        await expect(field).toHaveValue('10,5');
    });

    test('a photo picker closed without a photo keeps the sheet open', async ({ page }) => {
        // What the browser sends when the picker is dismissed: a `cancel` that bubbles up.
        await expenseSheet(page).locator('input[type="file"][multiple]').dispatchEvent('cancel', { bubbles: true });
        await expect(expenseSheet(page)).toBeVisible();
        await expect(page).toHaveURL(/\/add$/);
    });

    test('money received is a switch at the bottom', async ({ page }) => {
        await page.getByRole('switch', { name: 'Money received' }).click();
        await expect(page.getByRole('button', { name: /^received by/i })).toBeVisible();
    });

    test('save and add another stays on an empty form', async ({ page }) => {
        await page.getByPlaceholder('What was it for?').fill('Coffee');
        await page.getByPlaceholder('0.00').fill('4.5');
        await page.getByRole('button', { name: 'Save and add another' }).click();

        await expect(page.getByText('Expense added!')).toBeVisible();
        await expect(page).toHaveURL(/\/add$/);
        await expect(page.getByPlaceholder('0.00')).toHaveValue('');
        await expect(page.getByPlaceholder('What was it for?')).toHaveValue('');

        // Nothing typed since: closing does not ask.
        await closeExpenseSheet(page);
        await expect(expenseSheet(page)).toBeHidden();
        await expect(page.getByText('Coffee')).toBeVisible();
    });

    test('closing with something typed asks first', async ({ page }) => {
        await page.getByPlaceholder('What was it for?').fill('Groceries');
        await closeExpenseSheet(page);

        const dialog = page.getByRole('dialog', { name: 'Discard this expense?' });
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: 'Keep editing' }).click();
        await expect(page.getByPlaceholder('What was it for?')).toHaveValue('Groceries');

        await closeExpenseSheet(page);
        await dialog.getByRole('button', { name: 'Discard' }).click();
        await expect(expenseSheet(page)).toBeHidden();
        await expect(page).not.toHaveURL(/\/add$/);
    });

    test('back with something typed asks first', async ({ page }) => {
        await page.getByPlaceholder('What was it for?').fill('Groceries');
        await page.goBack();

        const dialog = page.getByRole('dialog', { name: 'Discard this expense?' });
        await dialog.getByRole('button', { name: 'Keep editing' }).click();
        await expect(page.getByPlaceholder('What was it for?')).toHaveValue('Groceries');
        await expect(page).toHaveURL(/\/add$/);

        await page.goBack();
        await dialog.getByRole('button', { name: 'Discard' }).click();
        await expect(expenseSheet(page)).toBeHidden();
        await expect(page).not.toHaveURL(/\/add$/);
    });

    test('opens over the expense list from its own address', async ({ page }) => {
        await closeExpenseSheet(page);
        await page.goto(`${page.url()}/add`);
        await expect(expenseSheet(page)).toBeVisible();
        await expect(page).toHaveURL(/\/add$/);

        // Back: the list it opened over.
        await closeExpenseSheet(page);
        await expect(page).toHaveURL(/\/k\/[a-z0-9]+\/?$/);
    });
});
