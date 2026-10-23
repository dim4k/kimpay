import { test, expect, type Page } from '@playwright/test';
import { createKimpay, dismissInstallPrompt, expenseSheet } from './test-utils';

// Computers (1280px): a rail of tabs, sheets in a panel beside the page, keys.
test.skip(({ isMobile }) => isMobile, 'Computers only');

async function addExpense(page: Page, description: string, amount: string) {
    await page.keyboard.press('n');
    const sheet = expenseSheet(page);
    await sheet.getByPlaceholder('What was it for?').fill(description);
    await sheet.getByPlaceholder('0.00').fill(amount);
    await sheet.getByRole('button', { name: /save expense/i }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole('button', { name: new RegExp(description) })).toBeVisible();
}

test.describe('Computer layout', () => {
    test.beforeEach(async ({ page }) => {
        await createKimpay(page, 'Desk Test', 'Alice');
        await dismissInstallPrompt(page);
    });

    test('the tabs are a rail, and keys change them', async ({ page }) => {
        await addExpense(page, 'Museum', '18');
        const rail = page.getByRole('navigation', { name: 'Menu' });
        await expect(rail.getByRole('link', { name: 'Add expense' })).toBeVisible();
        await page.keyboard.press('2');
        await expect(page).toHaveURL(/\/balance$/);
        await expect(rail.getByRole('link', { name: 'Balance' })).toHaveAttribute('aria-current', 'page');
        await page.keyboard.press('/');
        await expect(page).toHaveURL(/\/k\/[^/]+$/);
        await expect(page.getByPlaceholder('Search')).toBeFocused();

        await page.getByPlaceholder('Search').blur();
        await page.keyboard.press('?');
        await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
    });

    test('an expense opens beside the list, which stays usable', async ({ page }) => {
        await addExpense(page, 'Museum', '18');
        await addExpense(page, 'Taxi', '24');

        await page.getByRole('button', { name: /Taxi/ }).click();
        const sheet = expenseSheet(page);
        await expect(sheet.getByPlaceholder('What was it for?')).toHaveValue('Taxi');
        // The line open is marked in the list.
        await expect(page.getByRole('button', { name: /Taxi/ })).toHaveAttribute('aria-current', 'true');
        await expect(page.getByRole('button', { name: /Museum/ })).not.toHaveAttribute('aria-current');

        // Another line: in its place. The arrows go to the next one.
        await page.getByRole('button', { name: /Museum/ }).click();
        await expect(sheet.getByPlaceholder('What was it for?')).toHaveValue('Museum');
        await sheet.focus();
        await page.keyboard.press('ArrowUp');
        await expect(sheet.getByPlaceholder('What was it for?')).toHaveValue('Taxi');

        // Escape closes it, Back is not needed twice.
        await page.keyboard.press('Escape');
        await expect(sheet).toBeHidden();
        await expect(page).toHaveURL(/\/k\/[^/]+$/);
    });

    test('a new expense opens in a window over the page, not in the panel', async ({ page }) => {
        await addExpense(page, 'Museum', '18');
        await page.getByRole('button', { name: /Museum/ }).click();
        await expect(page.locator('[role="dialog"]:not(dialog)')).toHaveCount(1);

        await page.keyboard.press('n');
        const sheet = expenseSheet(page);
        await expect(sheet).toHaveAccessibleName('Add expense');
        await expect(page.locator('dialog[open]')).toHaveCount(1);
        await expect(page.locator('[role="dialog"]:not(dialog)')).toHaveCount(0);
    });

    test('a change typed is not lost to another line', async ({ page }) => {
        await addExpense(page, 'Museum', '18');
        await addExpense(page, 'Taxi', '24');

        await page.getByRole('button', { name: /Taxi/ }).click();
        await expenseSheet(page).getByPlaceholder('What was it for?').fill('Taxi home');
        await page.getByRole('button', { name: /Museum/ }).click();
        await expect(page.getByRole('dialog', { name: 'Discard this expense?' })).toBeVisible();
        await page.getByRole('button', { name: 'Keep editing' }).click();
        await expect(expenseSheet(page).getByPlaceholder('What was it for?')).toHaveValue('Taxi home');
    });

    test('Ctrl+Enter saves and stays on an empty form', async ({ page }) => {
        await page.keyboard.press('n');
        const sheet = expenseSheet(page);
        await sheet.getByPlaceholder('What was it for?').fill('Coffee');
        await sheet.getByPlaceholder('0.00').fill('3');
        await page.keyboard.press('Control+Enter');
        await expect(page.getByRole('button', { name: /Coffee/ })).toBeVisible();
        await expect(sheet.getByPlaceholder('What was it for?')).toHaveValue('');
    });

    test('the switcher and the profile are menus under their button', async ({ page }) => {
        const title = page.getByRole('button', { name: /Desk Test/ });
        await title.click();
        const switcher = page.getByRole('dialog', { name: 'Switch Kimpay' });
        await expect(switcher).toBeVisible();
        const [button, menu] = await Promise.all([title.boundingBox(), switcher.boundingBox()]);
        expect(menu!.y).toBeGreaterThan(button!.y + button!.height - 1);
        // A click elsewhere closes it; the page stays where it was.
        await page.mouse.click(640, 650);
        await expect(switcher).toBeHidden();

        await page.getByRole('button', { name: 'Menu' }).click();
        await expect(page.getByRole('dialog', { name: 'Profile' })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog', { name: 'Profile' })).toBeHidden();
    });

    test('members and settings use two columns', async ({ page }) => {
        await page.keyboard.press('3');
        // Nothing open at first; a member's sheet beside the list.
        await expect(page.getByRole('dialog', { name: 'Alice' })).toBeHidden();
        await page.locator('[data-participant-id]', { hasText: 'Alice' }).getByRole('button').first().click();
        await expect(page.getByRole('dialog', { name: 'Alice' })).toBeVisible();
        await page.keyboard.press('Escape');
        await page.keyboard.press('4');
        await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
    });
});
