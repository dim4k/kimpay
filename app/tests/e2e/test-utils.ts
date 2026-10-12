import { type Page, expect } from '@playwright/test';

/**
 * Creates a new Kimpay with the given name and creator name.
 * Handles the full flow including landing page navigation if not already there.
 */
export async function createKimpay(page: Page, kimpayName: string = 'Test Kimpay', creatorName: string = 'Test User') {
    // If we are not on the home page, go there
    if (new URL(page.url()).pathname !== '/') {
        await page.goto('/');
    }

    await page.getByPlaceholder('e.g. Trip to Paris').fill(kimpayName);
    await page.getByPlaceholder('e.g. Antoine').fill(creatorName);
    
    await page.getByRole('button', { name: /create|créer/i }).click();
    
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

/** Opens the profile (avatar): a sheet on phones, a popover on desktop. */
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

