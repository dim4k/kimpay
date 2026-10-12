import { test, expect, type Page, type BrowserContextOptions } from '@playwright/test';
import { createKimpay } from './test-utils';

/**
 * Visual regression baselines for the main screens, in light and dark mode,
 * for every Playwright project (desktop Chromium, Mobile Safari).
 *
 * Baselines are generated in the Docker Playwright image (Linux fonts and
 * rendering): `make test-visual-update`, then review and commit the PNGs.
 * Checked by `make test-e2e`.
 */
test.skip(process.platform !== 'linux', 'Visual baselines are generated in the Docker Playwright image');

/**
 * Opens the home page in a stable state. The clock is not faked (it would
 * also stall JS animations such as the balance count-up); the only date shown
 * ("today" in the date picker) is masked instead.
 */
async function setup(page: Page) {
    // Exchange rates come from an external API: keep the screens offline-stable.
    await page.route(/currency-api/, (route) => route.abort());
    await page.goto('/');
    // On mobile the install banner shows up asynchronously in groups: mark it
    // dismissed (as the app does, remembered for the context) so no screen
    // depends on that timing.
    if (test.info().project.use.isMobile) {
        await page.evaluate(() => new Promise<void>((resolve, reject) => {
            const request = indexedDB.open('keyval-store');
            request.onupgradeneeded = () => request.result.createObjectStore('keyval');
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const tx = request.result.transaction('keyval', 'readwrite');
                tx.objectStore('keyval').put('true', 'kimpay_install_dismissed');
                tx.oncomplete = () => { request.result.close(); resolve(); };
                tx.onerror = () => reject(tx.error);
            };
        }));
        await page.reload();
    }
}

/** Waits for transient UI (toasts) to go away, then compares the viewport. */
async function snapshot(page: Page, name: string, mask = [] as ReturnType<Page['locator']>[]) {
    await expect(page.locator('[data-toast]')).toHaveCount(0, { timeout: 10000 });
    // Focusing a field may scroll it into view (mobile): always compare the
    // top of the page, without focus.
    await page.evaluate(() => {
        (document.activeElement as HTMLElement | null)?.blur();
        document.querySelectorAll('main').forEach((main) => main.scrollTo(0, 0));
        window.scrollTo(0, 0);
    });
    // Soft: compare every screen of a test even when one differs.
    await expect.soft(page).toHaveScreenshot(`${name}.png`, { mask, maxDiffPixelRatio: 0.001 });
}

async function navTo(page: Page, name: RegExp) {
    await page.getByRole('navigation').getByRole('link', { name }).click();
}

async function addExpense(page: Page, description: string, amount: string) {
    await page.getByRole('link', { name: /add expense/i }).click();
    await expect(page).toHaveURL(/.*\/add/);
    await page.getByPlaceholder('What was it for?').fill(description);
    await page.getByPlaceholder('0.00').fill(amount);
    await page.getByRole('button', { name: /save|enregistrer/i }).first().click();
    await expect(page).toHaveURL(/\/k\/[a-z0-9]+\/?$/);
    await expect(page.getByText(description)).toBeVisible();
}

for (const colorScheme of ['light', 'dark'] as const) {
    test.describe(`Visual (${colorScheme})`, () => {
        // Reduced motion: the app then skips entrance animations and the
        // balance count-up, so every screenshot shows the final state.
        test.use({ colorScheme, reducedMotion: 'reduce' });

        test('Home', async ({ page }) => {
            await setup(page);
            await expect(page.getByPlaceholder('e.g. Trip to Paris')).toBeVisible();
            await snapshot(page, `home-${colorScheme}`);
        });

        test('Group screens', async ({ page, browser }) => {
            await setup(page);
            await createKimpay(page, 'Trip to Lisbon', 'Alice');
            const kimpayUrl = page.url();

            await expect(page.getByText('No expenses yet')).toBeVisible();
            await snapshot(page, `expenses-empty-${colorScheme}`);

            // Second participant, from the members.
            await navTo(page, /members/i);
            await page.getByPlaceholder('New name').fill('Bob');
            await page.getByRole('button', { name: /add/i }).click();
            await expect(page.locator('[data-is-me="false"]').getByText('Bob')).toBeVisible();
            await snapshot(page, `members-${colorScheme}`);

            // Inviting: a sheet with the link and the QR code (both contain
            // the random group id).
            await page.getByRole('button', { name: 'Invite to the group' }).click();
            const invite = page.getByRole('dialog', { name: 'Invite to the group' });
            await expect(invite.getByAltText(/QR code/i)).toBeVisible();
            await snapshot(page, `invite-${colorScheme}`, [invite.getByAltText(/QR code/i), invite.locator('.font-mono')]);
            await page.keyboard.press('Escape');
            await expect(invite).toBeHidden();

            await navTo(page, /^group$/i);
            await expect(page.getByRole('button', { name: /leave group/i })).toBeVisible();
            await snapshot(page, `group-settings-${colorScheme}`);

            // The profile: a sheet on phones, a popover on desktop.
            await page.getByRole('button', { name: 'Menu' }).click();
            await expect(page.getByRole('switch', { name: 'Show my payment links here' })).toBeVisible();
            await snapshot(page, `profile-${colorScheme}`, [page.getByText(/^Kimpay v/)]);
            await page.keyboard.press('Escape');
            await expect(page.getByRole('switch', { name: 'Show my payment links here' })).toBeHidden();

            // The group switcher behaves the same way.
            await page.getByRole('button', { name: /Trip to Lisbon/ }).click();
            await expect(page.getByRole('link', { name: /Trip to Lisbon/ })).toBeVisible();
            await snapshot(page, `group-switcher-${colorScheme}`);
            await page.keyboard.press('Escape');
            await expect(page.getByRole('link', { name: /Trip to Lisbon/ })).toBeHidden();

            await navTo(page, /expenses/i);
            await addExpense(page, 'Dinner', '60');
            await addExpense(page, 'Taxi', '24');
            await snapshot(page, `expenses-list-${colorScheme}`);

            await page.getByRole('link', { name: /add expense/i }).click();
            await expect(page.getByPlaceholder('What was it for?')).toBeVisible();
            // "Today" in the date picker changes every day.
            const datePicker = page.getByRole('button').filter({ has: page.locator('.lucide-calendar') });
            await snapshot(page, `add-expense-${colorScheme}`, [datePicker]);
            // Full-screen form: no tab bar until it is closed.
            await page.getByRole('link', { name: 'Close' }).click();

            await navTo(page, /balance/i);
            await expect(page.getByText('Bob').first()).toBeVisible();
            // The balance card shows its final amount.
            await expect(page.locator('section', { hasText: 'You are owed' }).getByText('€42.00', { exact: true })).toBeVisible();
            await expect(page.getByText('Group total €84.00')).toBeVisible();
            await snapshot(page, `balance-${colorScheme}`);


            // Another device opening the link is asked who they are.
            const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = test.info().project.use;
            const device = Object.fromEntries(
                Object.entries({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch })
                    .filter(([, value]) => value !== undefined),
            ) as BrowserContextOptions;
            const otherContext = await browser.newContext({ ...device, colorScheme, reducedMotion: 'reduce' });
            const other = await otherContext.newPage();
            await setup(other);
            await other.goto(kimpayUrl);
            await expect(other.getByRole('dialog').getByText('Bob')).toBeVisible();
            await snapshot(other, `identity-modal-${colorScheme}`);
            await otherContext.close();

            // Home now lists the group.
            await page.goto('/');
            await expect(page.getByText('Trip to Lisbon').first()).toBeVisible();
            await snapshot(page, `home-with-groups-${colorScheme}`);
        });
    });
}
