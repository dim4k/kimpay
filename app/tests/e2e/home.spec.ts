import { test, expect } from '@playwright/test';
import { createKimpay, dismissInstallPrompt } from './test-utils';

test.describe('Home and new group', () => {
    test('a new group asks who is in, then offers the link', async ({ page }) => {
        await createKimpay(page, 'Setup Test', 'Alice');
        await dismissInstallPrompt(page);

        const card = page.getByRole('region', { name: "Who's in?" });
        await expect(card).toBeVisible();
        await card.getByPlaceholder('New name').fill('Bob');
        await card.getByRole('button', { name: /add/i }).click();
        await expect(card.getByText('Bob')).toBeVisible();

        await card.getByRole('button', { name: 'Send the link' }).click();
        await expect(page.getByRole('dialog', { name: 'Invite to the group' })).toBeVisible();
    });

    test('joining is a link under the main action', async ({ page }) => {
        await createKimpay(page, 'Join Test', 'Alice');
        await page.goto('/');
        await expect(page.getByRole('button', { name: 'Create a group' })).toBeVisible();
        await page.getByRole('button', { name: 'I have a link or a QR code' }).click();
        await expect(page.getByRole('button', { name: 'Join', exact: true })).toBeVisible();
    });

    test('archives a group and restores it', async ({ page, isMobile }) => {
        // Pointer devices: a button on hover; phones swipe the line.
        test.skip(isMobile, 'Swipe gesture');
        await createKimpay(page, 'Trip A', 'Alice');
        await page.goto('/');
        await page.getByRole('button', { name: 'Create a group' }).click();
        await page.getByPlaceholder('e.g. Trip to Paris').fill('Trip B');
        await page.getByPlaceholder('e.g. Antoine').fill('Alice');
        await page.getByRole('button', { name: 'Create', exact: true }).click();
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
});
