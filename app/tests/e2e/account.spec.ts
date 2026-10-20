import { test, expect, type Page } from '@playwright/test';
import { createKimpay, dismissInstallPrompt, loginWithNewAccount, openMagicLink, openProfile } from './test-utils';

async function logout(page: Page, { forgetDevice = false } = {}) {
    await openProfile(page);
    await page.getByRole('button', { name: 'Log out' }).click();
    const dialog = page.getByRole('dialog', { name: 'Log out?' });
    if (forgetDevice) await dialog.getByRole('switch', { name: 'Remove my Kimpays from this device' }).click();
    await dialog.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/$/);
}

/** Deletes the groups saved on this device (as from the browser's devtools). */
async function clearDevice(page: Page) {
    await page.evaluate(() => new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onsuccess = () => {
            const tx = open.result.transaction('keyval', 'readwrite');
            tx.objectStore('keyval').clear();
            tx.oncomplete = () => { open.result.close(); resolve(); };
            tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
    }));
}

test.describe('Account on this device', () => {
    test('The empty home offers to find my Kimpays with my email', async ({ page }) => {
        await page.goto('/');
        await dismissInstallPrompt(page);
        await page.getByRole('button', { name: 'Find your Kimpays' }).click();

        const dialog = page.getByRole('dialog', { name: 'Log in or recover' });
        await dialog.getByPlaceholder('name@example.com').fill('nobody@kimpay.test');
        await dialog.getByRole('button', { name: 'Send magic link' }).click();
        await expect(dialog.getByText('If a Kimpay account exists for this address')).toBeVisible();
        await expect(dialog.getByText('No account? Then your Kimpays open again from their invite link.')).toBeVisible();
    });

    test('Logging in again on an emptied device brings the groups back without reload', async ({ page, context, request }) => {
        await createKimpay(page, 'Account Trip', 'Alice');
        await dismissInstallPrompt(page);
        const userId = await loginWithNewAccount(page, request, 'Alice');

        // Logged out: the groups stay on the device. Then they are deleted.
        await logout(page);
        await expect(page.getByRole('link', { name: /Account Trip/ })).toBeVisible();
        await clearDevice(page);
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible();

        // The magic link opens in another tab: the group shows up there, and
        // in the tab left on the home page.
        const linkTab = await context.newPage();
        await openMagicLink(linkTab, request, userId);
        await expect(linkTab.getByRole('link', { name: /Account Trip/ })).toBeVisible();
        await expect(page.getByRole('link', { name: /Account Trip/ })).toBeVisible();
    });

    test('Logging out can remove the account\'s groups from the device', async ({ page, request }) => {
        await createKimpay(page, 'Borrowed Phone', 'Alice');
        await dismissInstallPrompt(page);
        const userId = await loginWithNewAccount(page, request, 'Alice');

        await logout(page, { forgetDevice: true });
        await expect(page.getByRole('link', { name: /Borrowed Phone/ })).toBeHidden();
        // Nothing tells the next person an account was used here.
        await expect(page.getByLabel('Kimpay name', { exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeHidden();

        // Back with the next login.
        await openMagicLink(page, request, userId);
        await expect(page.getByRole('link', { name: /Borrowed Phone/ })).toBeVisible();
    });

    test('Logging in, the device takes the account\'s identity in a group', { tag: '@chromium-only' }, async ({ page, browser, request }) => {
        await createKimpay(page, 'Whose Phone', 'Alice');
        await dismissInstallPrompt(page);
        const kimpayUrl = page.url();
        const userId = await loginWithNewAccount(page, request, 'Alice');

        // On another device, someone joined as Bob; then Alice logs in there.
        const otherContext = await browser.newContext();
        const other = await otherContext.newPage();
        await other.goto(kimpayUrl);
        const identity = other.getByRole('dialog');
        await identity.getByPlaceholder('Your name').fill('Bob');
        await identity.getByRole('button', { name: 'Join' }).click();
        await expect(identity).toBeHidden();
        await dismissInstallPrompt(other);

        await openMagicLink(other, request, userId, `${new URL(kimpayUrl).pathname}/members`);
        await expect(other.locator('[data-is-me="true"]')).toContainText('Alice');

        // Alice is still herself on her first device.
        await page.goto(`${kimpayUrl}/members`);
        await expect(page.locator('[data-is-me="true"]')).toContainText('Alice');
        await otherContext.close();
    });

    test('Groups archived without an account join the account on login', { tag: '@chromium-only' }, async ({ page, browser, request }) => {
        await createKimpay(page, 'Old Trip', 'Alice');
        await dismissInstallPrompt(page);
        await page.getByRole('navigation').getByRole('link', { name: 'Settings', exact: true }).click();
        await page.getByRole('button', { name: /^archive kimpay/i }).click();
        await expect(page).toHaveURL(/\/$/);

        await expect(page.getByRole('button', { name: 'Archived (1)' })).toBeVisible();
        const merged = page.waitForResponse((r) => r.url().includes('/api/collections/users/records/') && r.request().method() === 'PATCH');
        const userId = await loginWithNewAccount(page, request, 'Alice');
        expect((await merged).ok()).toBe(true);

        // Another device logged in to the account has it folded in the archives.
        const otherContext = await browser.newContext();
        const other = await otherContext.newPage();
        await openMagicLink(other, request, userId);
        await expect(other.getByRole('button', { name: 'Archived (1)' })).toBeVisible();
        await expect(other.getByRole('link', { name: /Old Trip/ })).toBeHidden();
        await otherContext.close();
    });
});
