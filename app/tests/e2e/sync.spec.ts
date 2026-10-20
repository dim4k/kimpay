import { test, expect, type Page } from '@playwright/test';
import { closeExpenseSheet, createKimpay, dismissInstallPrompt, waitForServiceWorker } from './test-utils';

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
        await page.goto(kimpayUrl.replace(/\/?$/, '/members'));
        await page.getByPlaceholder('New name').fill('Bob');
        await page.getByRole('button', { name: /add/i }).click();
        await expect(page.getByText('Bob', { exact: true })).toBeVisible();

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
        // In the group: the news only (no balance), a dot on each new line.
        const card = page.getByTestId('list-summary');
        await expect(card).toHaveText(/2 new since your last visit/);
        await expect(card).not.toHaveText(/You owe|You are owed/);
        const dots = page.getByRole('img', { name: 'New', exact: true });
        await expect(dots).toHaveCount(2);

        // Opening a new line (its sheet): seen.
        await page.getByText('Bob Taxi').click();
        await closeExpenseSheet(page);
        await expect(page.locator('[data-expense]', { hasText: 'Bob Taxi' }).getByRole('img', { name: 'New', exact: true })).toHaveCount(0);
        await expect(card).toHaveText(/1 new since your last visit/);

        // The cross: all seen.
        await card.getByRole('button', { name: 'Mark as seen' }).click();
        await expect(card).toHaveCount(0);
        await expect(dots).toHaveCount(0);

        await page.getByRole('link', { name: 'My Kimpays' }).click();
        await expect(page.getByText('News Test')).toBeVisible();
        await expect(page.getByText(/\bnew\b/)).toHaveCount(0);
    });

    test('A group whose creation request is lost opens, takes expenses, and is synced', async ({ page }) => {
        // The browser says online, but the request never reaches the
        // server (weak signal): the creation is queued, not lost.
        const createRoute = '**/api/kimpay/create';
        await page.route(createRoute, (route) => route.abort('internetdisconnected'));
        await createKimpay(page, 'Offline Group', 'Olivia');
        await dismissInstallPrompt(page);

        // Queued behind the group it belongs to.
        await openAddExpense(page);
        await saveExpense(page, 'Offline Bread', '4');
        await expect(page.getByText('Offline Bread')).toHaveCount(1);

        // The server is reachable again: the group (with its creator) is
        // created in one request, then the expense that depends on it.
        const group = page.waitForResponse((r) =>
            r.url().includes('/api/kimpay/create') && r.request().method() === 'POST');
        const expense = page.waitForResponse((r) =>
            r.url().includes('/api/collections/expenses/records') && r.request().method() === 'POST');
        await page.unroute(createRoute);
        expect((await group).ok()).toBe(true);
        expect((await expense).ok()).toBe(true);

        await page.reload();
        await expect(page.getByText('Offline Group')).toBeVisible();
        await expect(page.getByText('Offline Bread')).toHaveCount(1);
        // The device kept its identity: no "Who are you?".
        await expect(page.getByRole('dialog', { name: 'Who are you?' })).toBeHidden();
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
                r.url().includes('/api/kimpay/') && r.url().includes('/data') && r.request().method() === 'GET');
            await expect(page.getByText('Offline Taxi')).toHaveCount(1);

            // The server has it (POST above): a fresh load shows exactly one too.
            await page.reload();
            await expect(page.getByText('Offline Taxi')).toBeVisible();
            await expect(page.getByText('Offline Taxi')).toHaveCount(1);
        });

        test('Writes queued before the app was closed are sent when it reopens', async ({ page, context }) => {
            await createKimpay(page, 'Reopen Test', 'Olivia');
            await dismissInstallPrompt(page);
            await waitForServiceWorker(page);
            const kimpayUrl = page.url();

            await openAddExpense(page);
            await context.setOffline(true);
            await saveExpense(page, 'Queued Ferry', '40');

            // Closed while offline: the connection comes back with no page open
            // to notice it, so the queue is replayed when the app starts.
            await page.close();
            await context.setOffline(false);
            const reopened = await context.newPage();
            const created = reopened.waitForResponse((r) =>
                r.url().includes('/api/collections/expenses/records') && r.request().method() === 'POST');
            await reopened.goto(kimpayUrl);
            expect((await created).ok()).toBe(true);

            // On the server: a fresh load still shows it.
            await reopened.reload();
            await expect(reopened.getByText('Queued Ferry')).toHaveCount(1);
        });
    });
});
