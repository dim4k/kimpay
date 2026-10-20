import { test, expect, type Page } from '@playwright/test';
import { closeExpenseSheet, createKimpay, dismissInstallPrompt, expenseSheet, repeatExpenseNow } from './test-utils';

/** `repeat`: how often, as the form says it ("Every month"). */
async function addExpense(page: Page, description: string, amount: string, repeat?: string) {
    await page.getByRole('link', { name: /add expense/i }).click();
    await page.getByPlaceholder('What was it for?').fill(description);
    await page.getByPlaceholder('0.00').fill(amount);
    if (repeat) {
        await page.getByRole('button', { name: /^Repeat\s*Never/ }).click();
        await page.getByRole('radio', { name: repeat }).click();
        await expect(page.getByRole('button', { name: new RegExp(`^Repeat\\s*${repeat} · next on`) })).toBeVisible();
    }
    await page.getByRole('button', { name: /save expense/i }).first().click();
    // Back on the list (a reload during that navigation is aborted).
    await expect(page).not.toHaveURL(/\/add$/);
    await expect(page.getByText(description).first()).toBeVisible();
}

test.describe('Repeated expenses', () => {
    test.beforeEach(async ({ page }) => {
        await createKimpay(page, 'Flat Share', 'Alice');
        await dismissInstallPrompt(page);
    });

    test('a copy is made each month, which takes the repetition over', { tag: '@chromium-only' }, async ({ page, request }) => {
        await addExpense(page, 'Rent', '900', 'Every month');
        const rent = page.locator('[data-expense]', { hasText: 'Rent' });
        await expect(rent.getByRole('img', { name: 'Every month' })).toBeVisible();

        // Its sheet says when the next one comes.
        await rent.getByRole('button').first().click();
        await expect(expenseSheet(page).getByText(/Every month · next on/)).toBeVisible();
        await closeExpenseSheet(page);

        const id = await rent.getAttribute('data-expense');
        await repeatExpenseNow(request, id!);
        await page.reload();

        await expect(page.locator('[data-expense]', { hasText: 'Rent' })).toHaveCount(2);
        // Only the copy repeats now.
        await expect(page.getByRole('img', { name: 'Every month' })).toHaveCount(1);
        await expect(page.locator(`[data-expense="${id}"]`).getByRole('img', { name: 'Every month' })).toHaveCount(0);

        await page.goto(page.url().replace(/\/?$/, '/settings/activity'));
        await expect(page.locator('[data-activity="expense_repeated"]')).toHaveCount(1);
        await expect(page.getByText(/Added automatically/)).toBeVisible();
    });

    test('every week: the copy repeats every week too', { tag: '@chromium-only' }, async ({ page, request }) => {
        await addExpense(page, 'Basket', '30', 'Every week');
        const basket = page.locator('[data-expense]', { hasText: 'Basket' });
        await expect(basket.getByRole('img', { name: 'Every week' })).toBeVisible();
        const id = await basket.getAttribute('data-expense');

        // Its sheet says how often.
        await basket.getByRole('button').first().click();
        await expect(expenseSheet(page).getByText(/Every week · next on/)).toBeVisible();
        await closeExpenseSheet(page);

        await repeatExpenseNow(request, id!);
        await page.reload();

        const copies = page.locator('[data-expense]', { hasText: 'Basket' });
        await expect(copies).toHaveCount(2);
        await expect(page.getByRole('img', { name: 'Every week' })).toHaveCount(1);
        await expect(page.getByRole('img', { name: 'Every month' })).toHaveCount(0);
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

test('the swipe of an expense is explained on the first two visits', async ({ page }) => {
    await createKimpay(page, 'Hint Group', 'Alice');
    await dismissInstallPrompt(page);
    const hint = page.getByText('Swipe an expense to the left to delete it.');

    // Nothing to swipe yet: not explained, not counted.
    await expect(hint).toHaveCount(0);
    await addExpense(page, 'Coffee', '3');
    await expect(hint).toBeAttached();
    await page.reload();
    await expect(hint).toBeAttached();
    await page.reload();
    await expect(page.getByText('Coffee')).toBeVisible();
    await expect(hint).toHaveCount(0);
});
