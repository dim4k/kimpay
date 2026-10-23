import { test, expect } from '@playwright/test';
import { createKimpay, dismissInstallPrompt, expenseSheet, switchIdentity } from './test-utils';

test.describe('Group history', () => {
    test('shows who added, changed and deleted what', { tag: '@chromium-only' }, async ({ page, isMobile }) => {
        await createKimpay(page, 'History Test', 'Alice');
        await dismissInstallPrompt(page);
        const base = page.url().replace(/\/$/, '');

        // A member, then an expense: added, edited, deleted.
        const card = page.getByRole('region', { name: 'Getting started' });
        await card.getByPlaceholder('New name').fill('Bob');
        await card.getByRole('button', { name: 'Add', exact: true }).click();
        await expect(card.getByText('Bob')).toBeVisible();

        await page.getByRole('link', { name: /add expense/i }).click();
        await page.getByPlaceholder('What was it for?').fill('Taxi');
        await page.getByPlaceholder('0.00').fill('20');
        await page.getByRole('button', { name: /save expense/i }).first().click();
        await page.getByRole('button', { name: /Taxi/ }).click();
        await page.getByPlaceholder('0.00').fill('25');
        await page.getByRole('button', { name: /update/i }).first().click();
        await expect(page.getByText('€25.00').first()).toBeVisible();

        // Bob deletes it, from this device.
        await switchIdentity(page, 'Bob');
        await page.getByRole('button', { name: /Taxi/ }).click();
        await expenseSheet(page).getByRole('button', { name: 'Delete', exact: true }).click();
        await page.getByRole('dialog', { name: 'Delete expense?' }).getByRole('button', { name: 'Delete' }).click();
        await expect(page.getByRole('button', { name: /Taxi/ })).toHaveCount(0);

        // Back as Alice: the list tells what the others changed.
        await switchIdentity(page, 'Alice');
        const news = page.getByRole('link', { name: /1 change by others/ });
        await expect(news).toBeVisible();
        await news.click();

        await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
        const deleted = page.locator('[data-activity="expense_deleted"]');
        await expect(deleted).toContainText('Taxi');
        await expect(deleted).toContainText('Bob');
        const edited = page.locator('[data-activity="expense_updated"]');
        await expect(edited).toContainText('Amount: €20.00 → €25.00');
        await expect(edited).toContainText('You');
        await expect(page.locator('[data-activity="participant_added"]')).toContainText('Bob');

        // Seen: no longer news on the list.
        await page.goto(base);
        await expect(page.getByRole('link', { name: /by others/ })).toHaveCount(0);

        // Also reached from the Settings tab (computers: beside the settings).
        await page.getByRole('navigation').getByRole('link', { name: 'Settings', exact: true }).click();
        if (isMobile) await page.getByRole('link', { name: /History/ }).click();
        await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
    });
});
