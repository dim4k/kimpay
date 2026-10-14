import { test, expect, type Page } from '@playwright/test';
import { createKimpay, dismissInstallPrompt } from './test-utils';

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

    test('a line is a button that opens its details', async ({ page }) => {
        await addExpense(page, 'Museum', '18');
        const line = page.getByRole('button', { name: /Museum/ });
        await expect(line).toHaveAttribute('aria-expanded', 'false');
        await line.click();
        await expect(line).toHaveAttribute('aria-expanded', 'true');
        // The actions are next to the line, not inside it.
        await expect(line.getByRole('button')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
    });

    test('duplicate opens a filled-in new expense', async ({ page }) => {
        await addExpense(page, 'Breakfast', '12');
        await page.getByRole('button', { name: /Breakfast/ }).click();
        await page.getByRole('button', { name: 'Duplicate' }).click();

        await expect(page).toHaveURL(/\/add\?from=/);
        await expect(page.getByPlaceholder('What was it for?')).toHaveValue('Breakfast');
        await expect(page.getByPlaceholder('0.00')).toHaveValue('12');
        await page.getByRole('button', { name: /save/i }).first().click();

        await expect(page.getByRole('button', { name: /Breakfast/ })).toHaveCount(2);
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
