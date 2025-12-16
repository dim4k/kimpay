import { test, expect } from '@playwright/test';
import { createKimpay, dismissInstallPrompt } from './test-utils';

test.describe('Settings & Participants', () => {

  test.beforeEach(async ({ page }) => {
    await createKimpay(page, 'Settings Test Group', 'Admin');
    await dismissInstallPrompt(page);
    // Go to settings
    const url = page.url();
    const settingsUrl = url.endsWith('/') ? `${url}settings` : `${url}/settings`;
    await page.goto(settingsUrl);
    await expect(page.getByText('Settings').first()).toBeVisible();
  });

  test('Add Participant', async ({ page }) => {
     await page.getByPlaceholder('New name').fill('Alice');
     await page.getByRole('button', { name: /add/i }).click(); // The '+' button typically has 'Add' or icon, check label
     
     await expect(page.getByText('Alice')).toBeVisible();
  });

  test('Verify Offline Buttons (Online Mode)', async ({ page }) => {
    // Ensure critical buttons are enabled when online
    const leaveBtn = page.getByRole('button', { name: /leave group/i });
    await expect(leaveBtn).toBeEnabled();
    
    const deleteBtn = page.getByRole('button', { name: /delete group/i });
    if (await deleteBtn.isVisible()) {
        await expect(deleteBtn).toBeEnabled();
    }
  });

  test('Switch Identity', async ({ page }) => {
     // 1. Add Alice
     await page.getByPlaceholder('New name').fill('Alice');
     await page.getByRole('button', { name: /add/i }).click(); 
     await expect(page.getByText('Alice').first()).toBeVisible();

     // 2. Switch Identity to Alice
     // Since we are "Admin", Alice is the only one with a switch button.
     const switchBtn = page.getByRole('button', { name: /switch identity|changer d'identité/i });
     await expect(switchBtn).toBeVisible();
     await switchBtn.click({ force: true });

     // 3. Confirm Modal
     // Wait for modal description to appear to ensure click worked and modal opened
     await expect(page.getByText(/switch to this identity|changer d'identité/i)).toBeVisible({ timeout: 10000 });

     const confirmBtn = page.getByRole('dialog').getByRole('button', { name: /save|enregistrer/i }); // 'Save' is the confirm text
     await expect(confirmBtn).toBeVisible();
     await confirmBtn.click({ force: true });
     
     // 4. Verify "You" badge moved and Page Reloaded
     // Ensure modal is gone
     await expect(page.getByRole('dialog')).toBeHidden();
     
     // Evaluate "You" badge position
     // Use .group class which identifies the row container
     // Remove exact:true because adding "You" badge changes the text content of the container to "Alice You"
     const newAliceRow = page.locator('.group', { has: page.getByText('Alice') });
     
     // Wait for the attribute to update (reactivity)
     await expect(newAliceRow).toHaveAttribute('data-is-me', 'true', { timeout: 15000 });
     await expect(newAliceRow.getByText(/you|vous/i)).toBeVisible();
     
     const adminRow = page.locator('.group', { has: page.getByText('Admin') });
     await expect(adminRow).toHaveAttribute('data-is-me', 'false');
     await expect(adminRow.getByText(/you|vous/i)).not.toBeVisible();
  });

});
