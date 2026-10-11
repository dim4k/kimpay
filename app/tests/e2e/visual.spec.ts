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
    // On iOS the install banner shows up asynchronously: wait for it and
    // dismiss it once (remembered for the context), so no screen depends on
    // that timing.
    if (test.info().project.use.isMobile) {
        await page.getByRole('button', { name: /dismiss install prompt/i }).click();
    }
}

/** Waits for transient UI (toasts) to go away, then compares the viewport. */
async function snapshot(page: Page, name: string, mask = [] as ReturnType<Page['locator']>[]) {
    await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 10000 });
    // Soft: compare every screen of a test even when one differs.
    await expect.soft(page).toHaveScreenshot(`${name}.png`, { mask, maxDiffPixelRatio: 0.001 });
}

async function navTo(page: Page, name: RegExp) {
    await page.getByRole('link', { name }).last().click();
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
        test.use({ colorScheme });

        test('Home', async ({ page }) => {
            await setup(page);
            await expect(page.getByPlaceholder('e.g. Trip to Paris')).toBeVisible();
            await snapshot(page, `home-${colorScheme}`);
        });

        test('Group screens', async ({ page, browser }) => {
            await setup(page);
            await createKimpay(page, 'Trip to Lisbon', 'Alice');
            const kimpayUrl = page.url();

            await expect(page.getByText(/0 items/i)).toBeVisible();
            await snapshot(page, `expenses-empty-${colorScheme}`);

            // Second participant, from the group settings.
            await navTo(page, /settings/i);
            await page.getByPlaceholder('New name').fill('Bob');
            await page.getByRole('button', { name: /add/i }).click();
            await expect(page.locator('[data-is-me="false"]').getByText('Bob')).toBeVisible();
            // Transient feedback, shown once the server confirmed: wait it out.
            await expect(page.getByText('Added!')).toBeVisible();
            await expect(page.getByText('Added!')).toBeHidden();
            await snapshot(page, `group-settings-${colorScheme}`);

            await navTo(page, /expenses/i);
            await addExpense(page, 'Dinner', '60');
            await addExpense(page, 'Taxi', '24');
            await snapshot(page, `expenses-list-${colorScheme}`);

            await page.getByRole('link', { name: /add expense/i }).click();
            await expect(page.getByPlaceholder('What was it for?')).toBeVisible();
            // "Today" in the date picker changes every day.
            const datePicker = page.getByRole('button').filter({ has: page.locator('.lucide-calendar') });
            await snapshot(page, `add-expense-${colorScheme}`, [datePicker]);

            await navTo(page, /balance/i);
            await expect(page.getByText('Bob').first()).toBeVisible();
            // Wait for the count-up animations to reach their final values.
            await expect(page.getByText('42.00', { exact: true })).toBeVisible();
            await expect(page.getByText('84.00', { exact: true })).toBeVisible();
            await snapshot(page, `balance-${colorScheme}`);

            // The QR code and the link contain the (random) group id.
            await navTo(page, /share/i);
            await expect(page.getByAltText('QR Code')).toBeVisible();
            await snapshot(page, `share-${colorScheme}`, [page.getByAltText('QR Code'), page.locator('.font-mono')]);

            // Another device opening the link is asked who they are.
            const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = test.info().project.use;
            const device = Object.fromEntries(
                Object.entries({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch })
                    .filter(([, value]) => value !== undefined),
            ) as BrowserContextOptions;
            const otherContext = await browser.newContext({ ...device, colorScheme });
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
