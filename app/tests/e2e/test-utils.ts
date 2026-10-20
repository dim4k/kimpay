import { type APIRequestContext, type Page, expect } from '@playwright/test';
import { createHash, randomBytes } from 'node:crypto';

const PB_URL = process.env.PUBLIC_POCKETBASE_URL || 'http://localhost:8090';
/** Superuser of the e2e stack (created by docker-compose.test.yml). */
const SUPERUSER = { identity: 'e2e@kimpay.test', password: 'e2e-superuser-password' };

/**
 * Creates a new Kimpay with the given name and creator name.
 * Handles the full flow including landing page navigation if not already there.
 */
export async function createKimpay(page: Page, kimpayName: string = 'Test Kimpay', creatorName: string = 'Test User') {
    // If we are not on the home page, go there
    if (new URL(page.url()).pathname !== '/') {
        await page.goto('/');
    }

    await page.getByLabel('Kimpay name', { exact: true }).fill(kimpayName);
    await page.getByLabel('Your first name').fill(creatorName);
    
    await page.getByRole('button', { name: /^(create the kimpay|créer le kimpay)$/i }).click();
    
    // Wait for redirection to dashboard
    await expect(page).toHaveURL(/\/k\//);
    await expect(page.getByText(kimpayName)).toBeVisible();
}

/**
 * Waits for the service worker to be activated (tests allowing it). A page
 * load started while it installs or activates can hang on Chromium, and the
 * offline cache only works once it is active. Chromium only: Playwright's
 * WebKit has no service workers.
 */
export async function waitForServiceWorker(page: Page) {
    if (page.context().browser()?.browserType().name() !== 'chromium') return;
    await page.evaluate(() => {
        const activated = navigator.serviceWorker.ready.then((registration) => new Promise<void>((resolve) => {
            const worker = registration.active!;
            if (worker.state === 'activated') return resolve();
            worker.addEventListener('statechange', () => {
                if (worker.state === 'activated') resolve();
            });
        }));
        return Promise.race([activated, new Promise<void>((resolve) => setTimeout(resolve, 10_000))]);
    });
}

/**
 * Dismisses the PWA install prompt if it appears.
 * Useful for mobile viewports.
 */
export async function dismissInstallPrompt(page: Page) {
    const installPromptClose = page.getByRole('button', { name: /dismiss install prompt/i });
    if (await installPromptClose.isVisible({ timeout: 2000 })) { // Short timeout as it might not appear
        await installPromptClose.click();
    }
}

/** Opens the profile (avatar): a sheet, centered on desktop. */
export async function openProfile(page: Page) {
    await page.getByRole('button', { name: 'Menu' }).click();
}

/**
 * Switches the current device identity to `name`, from the profile ("That's
 * not me"). The identity is applied in place (no page reload): wait for the
 * "Who are you?" dialog to close before returning.
 */
export async function switchIdentity(page: Page, name: string) {
    await openProfile(page);
    await page.getByRole('button', { name: "That's not me" }).click();

    const dialog = page.getByRole('dialog', { name: 'Who are you?' });
    await dialog.getByRole('button', { name: new RegExp(name) }).click();
    await expect(dialog).toBeHidden();
}

async function superuserHeaders(request: APIRequestContext) {
    const auth = await request.post(`${PB_URL}/api/collections/_superusers/auth-with-password`, { data: SUPERUSER });
    expect(auth.ok()).toBe(true);
    return { Authorization: (await auth.json()).token };
}

/**
 * Makes the monthly copies due now, as the hourly cron does (see
 * pocketbase/pb_hooks/repeat.pb.js), after moving the next copy of an
 * expense to today (UTC).
 */
export async function repeatExpenseNow(request: APIRequestContext, expenseId: string) {
    const headers = await superuserHeaders(request);
    const today = new Date().toISOString().slice(0, 10);
    const moved = await request.patch(`${PB_URL}/api/collections/expenses/records/${expenseId}`, {
        headers,
        data: { repeat_next: `${today} 00:00:00.000Z` },
    });
    expect(moved.ok(), await moved.text()).toBe(true);
    const run = await request.post(`${PB_URL}/api/crons/repeat_expenses`, { headers });
    expect(run.ok(), await run.text()).toBe(true);
}

/**
 * Logs this device in with a new account named `name`, through a real magic
 * link opened on the current page: like after a real login, the account
 * claims the device's participants (and the groups it created). The email is
 * skipped: the superuser stores the link's code. Returns the account's id.
 */
export async function loginWithNewAccount(page: Page, request: APIRequestContext, name: string): Promise<string> {
    const password = randomBytes(12).toString('hex');
    const email = `${name.toLowerCase()}-${randomBytes(6).toString('hex')}@kimpay.test`;
    const user = await request.post(`${PB_URL}/api/collections/users/records`, {
        headers: await superuserHeaders(request),
        data: { email, name, password, passwordConfirm: password, verified: true },
    });
    expect(user.ok()).toBe(true);
    const userId: string = (await user.json()).id;

    const claimed = page.waitForResponse((r) => r.url().includes('/api/collections/participants/records/') && r.request().method() === 'PATCH');
    const url = new URL(page.url());
    url.searchParams.set('code', await createLoginCode(request, userId));
    await page.goto(url.toString());
    expect((await claimed).ok()).toBe(true);
    await expect(page).not.toHaveURL(/[?&]code=/);
    return userId;
}

/** Opens a magic link logging in the account `userId`, on `path` (the home page by default). */
export async function openMagicLink(page: Page, request: APIRequestContext, userId: string, path = '/') {
    await page.goto(`${path}?code=${await createLoginCode(request, userId)}`);
    await expect(page).not.toHaveURL(/[?&]code=/);
}

async function createLoginCode(request: APIRequestContext, userId: string): Promise<string> {
    // Only the code's hash is stored (see pb_hooks/lib/email.js).
    const code = randomBytes(32).toString('hex');
    const otp = await request.post(`${PB_URL}/api/collections/auth_otps/records`, {
        headers: await superuserHeaders(request),
        data: {
            code: createHash('sha256').update(code).digest('hex'),
            user: userId,
            expires: new Date(Date.now() + 60 * 60 * 1000).toISOString().replace('T', ' '),
        },
    });
    expect(otp.ok()).toBe(true);
    return code;
}

/** The expense form, in its sheet over the group's pages. */
export function expenseSheet(page: Page) {
    return page.getByRole('dialog', { name: /^(add|edit) expense$/i });
}

/** Closes the expense form with the close button of its header (phones also have a handle named "Close"). */
export async function closeExpenseSheet(page: Page) {
    await expenseSheet(page).locator('header').getByRole('button', { name: 'Close' }).click();
}
