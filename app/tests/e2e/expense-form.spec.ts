import { test, expect } from '@playwright/test';
import { createKimpay, dismissInstallPrompt } from './test-utils';

test.describe('Expense form', () => {
    test.beforeEach(async ({ page }) => {
        await createKimpay(page, 'Form Test', 'Alice');
        await dismissInstallPrompt(page);
        await page.getByRole('link', { name: /add expense/i }).click();
        await expect(page).toHaveURL(/\/add$/);
    });

    test('the icon follows the description until picked', async ({ page }) => {
        const icon = page.getByRole('button', { name: 'Choose an emoji' });
        await page.getByPlaceholder('What was it for?').fill('Pizza night');
        await expect(icon).toHaveText('🍕');
        await page.getByPlaceholder('What was it for?').fill('Train tickets');
        await expect(icon).toHaveText('🚆');
    });

    test('an equal split is one line, unfolded on demand', async ({ page }) => {
        await page.getByPlaceholder('0.00').fill('30');
        const summary = page.getByRole('button', { name: /split equally/i });
        await expect(summary).toBeVisible();
        await summary.click();
        await expect(page.getByRole('radio', { name: 'Amounts' })).toBeVisible();
    });

    test('amounts of a split accept a decimal comma', async ({ page }) => {
        await page.getByPlaceholder('0.00').fill('30');
        await page.getByRole('button', { name: /split equally/i }).click();
        await page.getByRole('radio', { name: 'Amounts' }).click();
        const field = page.getByLabel('Share of Alice');
        await field.fill('10,5');
        await expect(field).toHaveValue('10,5');
    });

    test('money received is a switch at the bottom', async ({ page }) => {
        await page.getByRole('switch', { name: 'Money received' }).click();
        await expect(page.getByText('Received by')).toBeVisible();
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
        await page.getByRole('link', { name: 'Close' }).click();
        await expect(page.getByText('Coffee')).toBeVisible();
    });

    test('closing with something typed asks first', async ({ page }) => {
        await page.getByPlaceholder('What was it for?').fill('Groceries');
        await page.getByRole('link', { name: 'Close' }).click();

        const dialog = page.getByRole('dialog');
        await expect(dialog.getByText('Discard this expense?')).toBeVisible();
        await dialog.getByRole('button', { name: 'Keep editing' }).click();
        await expect(page.getByPlaceholder('What was it for?')).toHaveValue('Groceries');

        await page.getByRole('link', { name: 'Close' }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Discard' }).click();
        await expect(page).not.toHaveURL(/\/add$/);
    });
});
