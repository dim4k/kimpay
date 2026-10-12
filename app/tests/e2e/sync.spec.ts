import { test, expect, type Page } from '@playwright/test';
import { createKimpay, dismissInstallPrompt, waitForServiceWorker } from './test-utils';

async function openAddExpense(page: Page) {
    await page.getByRole('link', { name: /add expense/i }).click();
    await expect(page).toHaveURL(/.*\/add/);
    await expect(page.getByPlaceholder('What was it for?')).toBeVisible();
}

async function saveExpense(page: Page, description: string, amount: string) {
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
        await openAddExpense(page);
        await saveExpense(page, 'Realtime Pizza', '12');
        await expect(other.getByText('Realtime Pizza')).toBeVisible({ timeout: 10000 });

        await otherContext.close();
    });

    test('Home flags the expenses others added since my last visit', async ({ page, browser }) => {
        await createKimpay(page, 'News Test', 'Alice');
        await dismissInstallPrompt(page);
        const kimpayUrl = page.url();
        await page.goto(kimpayUrl.replace(/\/?$/, '/settings'));
        await page.getByPlaceholder('New name').fill('Bob');
        await page.getByRole('button', { name: /add/i }).click();
        await expect(page.getByText('Bob')).toBeVisible();

        // Mine do not count.
        await page.getByRole('navigation').getByRole('link', { name: /expenses/i }).click();
        await openAddExpense(page);
        await saveExpense(page, 'My Coffee', '3');
        await page.goto('/');
        await expect(page.getByText('News Test')).toBeVisible();
        await expect(page.getByText(/\bnew\b/)).toHaveCount(0);

        // Bob adds two from his phone while I am away.
        const otherContext = await browser.newContext();
        const other = await otherContext.newPage();
        await other.goto(kimpayUrl);
        const identity = other.getByRole('dialog');
        await identity.getByRole('button', { name: /bob/i }).click();
        await expect(identity).toBeHidden();
        await dismissInstallPrompt(other);
        for (const [description, amount] of [['Bob Pizza', '20'], ['Bob Taxi', '15']] as const) {
            await openAddExpense(other);
            await saveExpense(other, description, amount);
        }
        await otherContext.close();

        await page.reload();
        await expect(page.getByText('2 new')).toBeVisible();

        // Opening the group marks them as seen.
        await page.getByText('News Test').click();
        await expect(page.getByText('Bob Taxi')).toBeVisible();
        await page.getByRole('link', { name: 'My Kimpays' }).click();
        await expect(page.getByText('News Test')).toBeVisible();
        await expect(page.getByText(/\bnew\b/)).toHaveCount(0);
    });

    test.describe('with the service worker', () => {
        // The offline cache is the service worker's job (Chromium only in Playwright).
        test.use({ serviceWorkers: 'allow' });

        test('An expense created offline is synced once, without duplicate', async ({ page, context }) => {
            await createKimpay(page, 'Offline Test', 'Olivia');
            await dismissInstallPrompt(page);
            await waitForServiceWorker(page);

            // Open the form while online: Playwright only supports service workers
            // on Chromium, so on WebKit nothing would serve the route's code offline
            // (a real Safari has it cached by the service worker).
            await openAddExpense(page);
            await context.setOffline(true);
            await saveExpense(page, 'Offline Taxi', '30');
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

            // The server has it (POST above): a fresh load shows exactly one too.
            await page.reload();
            await expect(page.getByText('Offline Taxi')).toBeVisible();
            await expect(page.getByText('Offline Taxi')).toHaveCount(1);
        });
    });
});
