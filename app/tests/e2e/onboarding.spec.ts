import { test, expect } from '@playwright/test';

test.describe('Onboarding & Validation', () => {

  test('Validation: says what is missing instead of creating', async ({ page }) => {
    await page.goto('/');
    const createBtn = page.getByRole('button', { name: 'Create the group' });
    const missing = page.locator('#create-missing');

    // The button stays lit; under it, what is left to fill in.
    await expect(createBtn).toBeEnabled();
    await expect(missing).toHaveText("Missing: the group's name, your first name");

    await page.getByLabel('Group name', { exact: true }).fill('Test Kimpay');
    await expect(missing).toHaveText('Missing: your first name');
    await createBtn.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByLabel('Your first name')).toBeFocused();
  });

  test('Validation: Cannot create Kimpay with invalid email', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Group name', { exact: true }).fill('Email Test');
    await page.getByLabel('Your first name').fill('Tester');

    // Optional, always shown, with what it is for.
    await expect(page.getByText('To find the group again on any device')).toBeVisible();
    await page.getByLabel('Get the link by email').fill('invalid-email');
    await page.getByRole('button', { name: 'Create the group' }).click();

    // Told under the field
    await expect(page.getByText('Please enter a valid email address')).toBeVisible();
  });

  test('A suggestion fills the name and the emoji of the group', async ({ page }) => {
    await page.goto('/');
    const suggestion = page.getByRole('group', { name: 'Suggested names' }).getByRole('button', { name: 'Holidays' });
    await suggestion.click();
    await expect(page.getByLabel('Group name', { exact: true })).toHaveValue('Holidays');
    await expect(page.getByRole('button', { name: 'Choose an emoji' })).toHaveText('🏖️');
    await expect(suggestion).toHaveAttribute('aria-pressed', 'true');

    // Typed over: no suggestion is the chosen one any more.
    await page.getByLabel('Group name', { exact: true }).fill('Holidays in Crete');
    await expect(suggestion).toHaveAttribute('aria-pressed', 'false');
  });

  test('Successful Kimpay Creation', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Group name', { exact: true }).fill('Success Trip');
    await page.getByLabel('Your first name').fill('Creator');

    await page.getByRole('button', { name: 'Create the group' }).click();

    await expect(page).toHaveURL(/\/k\//);
    await expect(page.getByText('Success Trip')).toBeVisible();
    // My identity in the group is in the avatar menu
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByText('Creator')).toBeVisible();
  });

  test('Switch between Kimpays', async ({ page }) => {
    // 1. Create First Kimpay
    await page.goto('/');
    await page.getByLabel('Group name', { exact: true }).fill('Trip A');
    await page.getByLabel('Your first name').fill('User A');
    await page.getByRole('button', { name: 'Create the group' }).click();
    await expect(page).toHaveURL(/\/k\//);

    // 2. Go Home: groups come first, the creation form opens from its tile
    await page.goto('/');
    await page.getByRole('button', { name: /create a group/i }).click();

    // 3. Create Second Kimpay
    await page.getByLabel('Group name', { exact: true }).fill('Trip B');
    // Name might be pre-filled from local storage if not cleared, but let's overwrite
    await page.getByLabel('Your first name').fill('User B');
    await page.getByRole('button', { name: 'Create the group' }).click();
    await expect(page).toHaveURL(/\/k\//);
    await expect(page.getByText('Trip B')).toBeVisible();

    // 4. Go Home and verify list
    await page.goto('/');

    // Both should be visible in history
    await expect(page.getByText('Trip A')).toBeVisible();
    await expect(page.getByText('Trip B')).toBeVisible();

    // 5. Navigate to Trip A
    await page.getByText('Trip A').click();
    await expect(page.getByText('Trip A')).toBeVisible();
    await expect(page.getByText('Trip B')).not.toBeVisible();
  });

});
