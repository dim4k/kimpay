import { test, expect } from '@playwright/test';
import { createKimpay, dismissInstallPrompt } from './test-utils';

test.describe('Home and new group', () => {
    test('a new group asks who is in, then offers the link', async ({ page }) => {
        await createKimpay(page, 'Setup Test', 'Alice');
        await dismissInstallPrompt(page);

        const card = page.getByRole('region', { name: 'Getting started' });
        await expect(card).toBeVisible();
        await card.getByPlaceholder('New name').fill('Bob');
        await card.getByRole('button', { name: 'Add', exact: true }).click();
        await expect(card.getByText('Bob')).toBeVisible();

        await card.getByRole('button', { name: 'Invite', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Invite to the Kimpay' })).toBeVisible();
    });

    test('joining is a link under the main action', async ({ page }) => {
        await createKimpay(page, 'Join Test', 'Alice');
        await page.goto('/');
        await expect(page.getByRole('button', { name: 'Create a Kimpay' })).toBeVisible();
        await page.getByRole('button', { name: 'I have a link or a QR code' }).click();
        await expect(page.getByRole('button', { name: 'Join', exact: true })).toBeVisible();
    });

    test('archives a group and restores it', async ({ page, isMobile }) => {
        // Pointer devices: a button on hover; phones swipe the line.
        test.skip(isMobile, 'Swipe gesture');
        await createKimpay(page, 'Trip A', 'Alice');
        await page.goto('/');
        await page.getByRole('button', { name: 'Create a Kimpay' }).click();
        await page.getByLabel('Kimpay name', { exact: true }).fill('Trip B');
        await page.getByLabel('Your first name').fill('Alice');
        await page.getByRole('button', { name: 'Create the Kimpay' }).click();
        await expect(page).toHaveURL(/\/k\//);
        await page.goto('/');

        const tripA = page.getByRole('link', { name: /Trip A/ });
        await tripA.hover();
        await page.locator('.group', { has: tripA }).getByRole('button', { name: 'Archive' }).click();
        await expect(page.getByText('Trip A archived')).toBeVisible();
        await expect(tripA).toBeHidden();

        await page.getByRole('button', { name: 'Archived (1)' }).click();
        await expect(tripA).toBeVisible();
        await tripA.hover();
        await page.locator('.group', { has: tripA }).getByRole('button', { name: 'Restore' }).click();
        await expect(page.getByRole('button', { name: /Archived/ })).toBeHidden();
        await expect(tripA).toBeVisible();
    });

    test('the switcher folds the archived groups', async ({ page }) => {
        await createKimpay(page, 'Trip A', 'Alice');
        await dismissInstallPrompt(page);
        await page.goto('/');
        await page.getByRole('button', { name: 'Create a Kimpay' }).click();
        await page.getByLabel('Kimpay name', { exact: true }).fill('Trip B');
        await page.getByLabel('Your first name').fill('Alice');
        await page.getByRole('button', { name: 'Create the Kimpay' }).click();
        await expect(page).toHaveURL(/\/k\//);
        await page.goto('/');
        const tripA = page.getByRole('link', { name: /Trip A/ });
        await tripA.click();
        await page.getByRole('navigation').getByRole('link', { name: 'Settings', exact: true }).click();
        await page.getByRole('button', { name: /^archive kimpay/i }).click();
        await expect(page).toHaveURL(/\/$/);

        await page.getByRole('link', { name: /Trip B/ }).click();
        await page.getByRole('button', { name: /Trip B/ }).click();
        await expect(page.getByRole('link', { name: /Trip B/ })).toBeVisible();
        await expect(tripA).toBeHidden();
        await page.getByRole('button', { name: 'Archived (1)' }).click();
        await expect(tripA).toBeVisible();
    });
});
