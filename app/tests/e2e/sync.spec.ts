import { test, expect, type Page } from '@playwright/test';
import { createKimpay, dismissInstallPrompt } from './test-utils';

async function addExpense(page: Page, description: string, amount: string) {
    await page.getByRole('link', { name: /add expense/i }).click();
    await expect(page).toHaveURL(/.*\/add/);
    await page.getByPlaceholder('What was it for?').fill(description);
    await page.getByPlaceholder('0.00').fill(amount);
    await page.getByRole('button', { name: /save|enregistrer/i }).first().click();
    await expect(page).toHaveURL(/\/k\/[a-z0-9]+\/?$/);
}

test.describe('Sync between devices', () => {
    test('Changes made on one device show up on the other without reload', async ({ page, browser }) => {
        await createKimpay(page, 'Sync Test', 'Alice');
        await dismissInstallPrompt(page);
        const kimpayUrl = page.url();

        // Second device opens the shared link and picks an identity in place.
        const otherContext = await browser.newContext();
        const other = await otherContext.newPage();
        await other.goto(kimpayUrl);
        const identity = other.getByRole('dialog');
        await identity.getByRole('button', { name: /alice/i }).click();
        await expect(identity).toBeHidden();
        await dismissInstallPrompt(other);

        // Realtime: an expense added on device A appears on device B.
        await addExpense(page, 'Realtime Pizza', '12');
        await expect(other.getByText('Realtime Pizza')).toBeVisible({ timeout: 10000 });

        await otherContext.close();
    });

    test('An expense created offline is synced once, without duplicate', async ({ page, context }) => {
        await createKimpay(page, 'Offline Test', 'Olivia');
        await dismissInstallPrompt(page);

        await context.setOffline(true);
        await addExpense(page, 'Offline Taxi', '30');
        await expect(page.getByText('Offline Taxi')).toHaveCount(1);

        // Back online: the queue is replayed, then the group is refetched
        // (realtime / resync). The optimistic item must be merged with the
        // server one, not shown next to it.
        const created = page.waitForResponse((r) =>
            r.url().includes('/api/collections/expenses/records') && r.request().method() === 'POST');
        await context.setOffline(false);
        expect((await created).ok()).toBe(true);
        await page.waitForResponse((r) =>
            r.url().includes('/api/collections/kimpays/records/') && r.request().method() === 'GET');
        await expect(page.getByText('Offline Taxi')).toHaveCount(1);

        // Once the server has it, a fresh load shows exactly one as well.
        await expect.poll(async () => {
            await page.reload();
            return page.getByText('Offline Taxi').count();
        }, { timeout: 15000 }).toBe(1);
    });
});
