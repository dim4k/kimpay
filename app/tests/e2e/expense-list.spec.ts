import { test, expect, type Page } from '@playwright/test';
import { createKimpay, dismissInstallPrompt, expenseSheet } from './test-utils';

async function addExpense(page: Page, description: string, amount: string) {
    await page.getByRole('link', { name: /add expense/i }).click();
    await page.getByPlaceholder('What was it for?').fill(description);
    await page.getByPlaceholder('0.00').fill(amount);
    await page.getByRole('button', { name: /save/i }).first().click();
    await expect(page.getByText(description).first()).toBeVisible();
}

test.describe('Expense list', () => {
    test.beforeEach(async ({ page }) => {
        await createKimpay(page, 'List Test', 'Alice');
        await dismissInstallPrompt(page);
    });

    test('a line opens its sheet, read first, saved once changed', async ({ page }) => {
        await addExpense(page, 'Museum', '18');
        const line = page.getByRole('button', { name: /Museum/ });
        await expect(line).toHaveAttribute('aria-haspopup', 'dialog');
        await line.click();

        const sheet = expenseSheet(page);
        await expect(sheet.getByPlaceholder('What was it for?')).toHaveValue('Museum');
        await expect(sheet.getByRole('button', { name: /update expense/i })).toHaveCount(0);
        await sheet.getByPlaceholder('What was it for?').fill('Museum tickets');
        await sheet.getByRole('button', { name: /update expense/i }).click();
        await expect(page.getByRole('button', { name: /Museum tickets/ })).toBeVisible();
    });

    test('duplicate opens a filled-in new expense', async ({ page }) => {
        await addExpense(page, 'Breakfast', '12');
        await page.getByRole('button', { name: /Breakfast/ }).click();
        await expenseSheet(page).getByRole('button', { name: 'Duplicate' }).click();

        await expect(page).toHaveURL(/\/add\?from=/);
        await expect(page.getByPlaceholder('What was it for?')).toHaveValue('Breakfast');
        await expect(page.getByPlaceholder('0.00')).toHaveValue('12');
        await page.getByRole('button', { name: /save/i }).first().click();

        await expect(page.getByRole('button', { name: /Breakfast/ })).toHaveCount(2);
    });

    test('a note is kept, and found by the search', async ({ page }) => {
        await page.getByRole('link', { name: /add expense/i }).click();
        const sheet = expenseSheet(page);
        await sheet.getByPlaceholder('What was it for?').fill('Hotel');
        await sheet.getByPlaceholder('0.00').fill('120');
        await sheet.getByRole('button', { name: /^Note/ }).click();
        await sheet.getByRole('textbox', { name: 'Note' }).fill('Deposit, the rest on arrival');
        await sheet.getByRole('button', { name: 'OK' }).click();
        await expect(sheet.getByText('Deposit, the rest on arrival')).toBeVisible();
        await sheet.getByRole('button', { name: /save/i }).first().click();
        await expect(sheet).toBeHidden();
        await expect(page.getByRole('button', { name: /Hotel/ })).toBeVisible();

        const search = page.getByRole('searchbox', { name: 'Search' });
        await search.fill('arrival');
        await expect(search).toHaveValue('arrival');
        await expect(page.getByRole('button', { name: /Hotel/ })).toBeVisible();
        await expect(page.getByText('1 result')).toBeVisible();
    });

    test('three sorts, a second tap reverses', async ({ page }) => {
        await addExpense(page, 'Small', '5');
        await addExpense(page, 'Big', '50');
        await page.getByRole('button', { name: 'Filters' }).click();

        const sort = page.getByRole('button', { name: 'Sort' });
        await expect(sort).toHaveText(/Date ↓/);
        await sort.click();
        await page.getByRole('option', { name: 'Amount', exact: true }).click();
        await expect(sort).toHaveText(/Amount ↓/);
        await expect(page.locator('[data-expense]').first()).toContainText('Big');

        await sort.click();
        await page.getByRole('option', { name: 'Amount ↓' }).click();
        await expect(sort).toHaveText(/Amount ↑/);
        await expect(page.locator('[data-expense]').first()).toContainText('Small');
    });
});
