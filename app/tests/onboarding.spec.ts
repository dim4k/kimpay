import { test, expect } from '@playwright/test';

test.describe('Onboarding & Validation', () => {

  test('Validation: Cannot create Kimpay with empty fields', async ({ page }) => {
    await page.goto('/');
    const createBtn = page.getByRole('button', { name: /create|créer/i });
    
    // Initially disabled
    await expect(createBtn).toBeDisabled();
    
    // Fill only one field
    await page.getByPlaceholder('e.g. Trip to Paris').fill('Test Kimpay');
    await expect(createBtn).toBeDisabled();
    
    await page.getByPlaceholder('e.g. Trip to Paris').clear();
    await page.getByPlaceholder('e.g. Antoine').fill('Test User');
    await expect(createBtn).toBeDisabled();
  });

  test('Validation: Cannot create Kimpay with invalid email', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('e.g. Trip to Paris').fill('Email Test');
    await page.getByPlaceholder('e.g. Antoine').fill('Tester');
    
    const emailInput = page.getByPlaceholder('your@email.com');
    if (await emailInput.isVisible()) {
        await emailInput.fill('invalid-email');
        await page.getByRole('button', { name: /create|créer/i }).click();
        
        // Expect Modal Alert
        await expect(page.getByText('Invalid Email')).toBeVisible();
    }
  });

  test('Successful Kimpay Creation', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('e.g. Trip to Paris').fill('Success Trip');
    await page.getByPlaceholder('e.g. Antoine').fill('Creator');
    
    await page.getByRole('button', { name: /create|créer/i }).click();
    
    await expect(page).toHaveURL(/\/k\//);
    await expect(page.getByText('Success Trip')).toBeVisible();
    await expect(page.getByText('Creator')).toBeVisible();
  });

  test('Switch between Kimpays', async ({ page }) => {
    // 1. Create First Kimpay
    await page.goto('/');
    await page.getByPlaceholder('e.g. Trip to Paris').fill('Trip A');
    await page.getByPlaceholder('e.g. Antoine').fill('User A');
    await page.getByRole('button', { name: /create|créer/i }).click();
    await expect(page).toHaveURL(/\/k\//);
    
    // 2. Go Home
    await page.goto('/');
    
    // 3. Create Second Kimpay
    await page.getByPlaceholder('e.g. Trip to Paris').fill('Trip B');
    // Name might be pre-filled from local storage if not cleared, but let's overwrite
    await page.getByPlaceholder('e.g. Antoine').fill('User B'); 
    await page.getByRole('button', { name: /create|créer/i }).click();
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
