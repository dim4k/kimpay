import { test, expect, type Page } from '@playwright/test';
import { createKimpay, dismissInstallPrompt, repeatExpenseNow, waitForServiceWorker } from './test-utils';

async function addExpense(page: Page, description: string, amount: string, repeat = false) {
    await page.getByRole('link', { name: /add expense/i }).click();
    await page.getByPlaceholder('What was it for?').fill(description);
    await page.getByPlaceholder('0.00').fill(amount);
    if (repeat) await page.getByRole('switch', { name: 'Repeat every month' }).click();
    await page.getByRole('button', { name: /save expense/i }).first().click();
    await expect(page.getByText(description).first()).toBeVisible();
}

test.describe('Expenses repeated every month', () => {
    test.beforeEach(async ({ page }) => {
        await createKimpay(page, 'Flat Share', 'Alice');
        await dismissInstallPrompt(page);
    });

    test('a copy is made each month, which takes the repetition over', async ({ page, request }) => {
        await addExpense(page, 'Rent', '900', true);
        const rent = page.locator('[data-expense]', { hasText: 'Rent' });
        await expect(rent.getByRole('img', { name: 'Every month' })).toBeVisible();

        // Its details say when the next one comes.
        await rent.getByRole('button').first().click();
        await expect(page.locator('dt', { hasText: /^Repeats$/ })).toBeVisible();
        await expect(page.getByText(/Every month · next on/)).toBeVisible();

        const id = await rent.getAttribute('data-expense');
        await repeatExpenseNow(request, id!);
        await waitForServiceWorker(page);
        await page.reload();

        await expect(page.locator('[data-expense]', { hasText: 'Rent' })).toHaveCount(2);
        // Only the copy repeats now.
        await expect(page.getByRole('img', { name: 'Every month' })).toHaveCount(1);
        await expect(page.locator(`[data-expense="${id}"]`).getByRole('img', { name: 'Every month' })).toHaveCount(0);

        await page.goto(page.url().replace(/\/?$/, '/settings/activity'));
        await expect(page.locator('[data-activity="expense_repeated"]')).toHaveCount(1);
        await expect(page.getByText(/Added automatically/)).toBeVisible();
    });

    test('an expense not repeated has no icon', async ({ page }) => {
        await addExpense(page, 'Groceries', '40');
        await expect(page.getByRole('img', { name: 'Every month' })).toHaveCount(0);
    });
});

test.describe("App icon's shortcuts", () => {
    test('add and scan open the form in the group opened last', async ({ page }) => {
        await createKimpay(page, 'Shortcut Group', 'Alice');
        await dismissInstallPrompt(page);
        const group = new URL(page.url()).pathname;

        await page.goto('/shortcut/add');
        await expect(page).toHaveURL(new RegExp(`${group}/add$`));
        await expect(page.getByPlaceholder('What was it for?')).toBeVisible();
        const sheet = page.getByRole('dialog');
        await expect(sheet.getByRole('button', { name: 'Scan a receipt' })).toHaveCount(0);

        await page.goto('/shortcut/scan');
        await expect(page).toHaveURL((url) => url.pathname === `${group}/add` && url.search === '?scan');
        // The camera opens from a tap only: the button to tap first.
        await expect(sheet.getByRole('button', { name: 'Scan a receipt' })).toBeVisible();
    });

    test('without a group, the home page', async ({ page }) => {
        await page.goto('/shortcut/add');
        await expect(page).toHaveURL(/\/$/);
    });
});

test('the swipes of an expense are explained on the first two visits', async ({ page }) => {
    await createKimpay(page, 'Hint Group', 'Alice');
    await dismissInstallPrompt(page);
    const hint = page.getByText('Swipe an expense left to delete it, right to edit it.');

    // Nothing to swipe yet: not explained, not counted.
    await expect(hint).toHaveCount(0);
    await addExpense(page, 'Coffee', '3');
    await expect(hint).toBeAttached();
    await waitForServiceWorker(page);
    await page.reload();
    await expect(hint).toBeAttached();
    await page.reload();
    await expect(page.getByText('Coffee')).toBeVisible();
    await expect(hint).toHaveCount(0);
});
