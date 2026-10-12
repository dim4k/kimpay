import { test, expect } from '@playwright/test';
import { createKimpay, dismissInstallPrompt, switchIdentity } from './test-utils';

test.describe('Members & group settings', () => {

  test.beforeEach(async ({ page }) => {
    await createKimpay(page, 'Settings Test Group', 'Admin');
    await dismissInstallPrompt(page);
    // Go to the members
    await page.goto(page.url().replace(/\/?$/, '/members'));
    await expect(page.getByPlaceholder('New name')).toBeVisible();
  });

  test('Add Participant', async ({ page }) => {
     await page.getByPlaceholder('New name').fill('Alice');
     await page.getByRole('button', { name: /add/i }).click(); // The '+' button typically has 'Add' or icon, check label

     await expect(page.getByText('Alice').first()).toBeVisible();
     // Nobody has paid yet: both are settled up, and Alice can be removed.
     const alice = page.locator('[data-is-me="false"]', { hasText: 'Alice' });
     await expect(alice.getByText('settled')).toBeVisible();
     await expect(alice.getByRole('button', { name: /delete participant/i })).toBeVisible();
  });

  test('Verify Offline Buttons (Online Mode)', async ({ page }) => {
    await page.getByRole('navigation').getByRole('link', { name: 'Group', exact: true }).click();
    // Ensure critical buttons are enabled when online
    const leaveBtn = page.getByRole('button', { name: /leave group/i });
    await expect(leaveBtn).toBeEnabled();

    const deleteBtn = page.getByRole('button', { name: /delete group/i });
    if (await deleteBtn.isVisible()) {
        await expect(deleteBtn).toBeEnabled();
    }
  });

  test('Opens the profile from its shortcut', async ({ page }) => {
     // On my own row of the participants list
     await page.locator('[data-is-me="true"]').getByRole('button', { name: 'My profile' }).click();
     await expect(page.getByRole('switch', { name: 'Show my payment links here' })).toBeVisible();
  });

  test('Switch Identity', async ({ page }) => {
     // 1. Add Alice
     await page.getByPlaceholder('New name').fill('Alice');
     await page.getByRole('button', { name: /add/i }).click();
     await expect(page.getByText('Alice').first()).toBeVisible();

     // 2. Switch Identity to Alice, from the profile ("That's not me")
     await switchIdentity(page, 'Alice');

     // 3. Verify "You" badge moved

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
