import { Page, expect } from '@playwright/test';

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
 * Dismisses the PWA install prompt if it appears.
 * Useful for mobile viewports.
 */
export async function dismissInstallPrompt(page: Page) {
    const installPromptClose = page.getByRole('button', { name: /dismiss install prompt/i });
    if (await installPromptClose.isVisible({ timeout: 2000 })) { // Short timeout as it might not appear
        await installPromptClose.click();
    }
}
