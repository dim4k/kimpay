import { test, expect } from '@playwright/test';
import { createKimpay, dismissInstallPrompt, loginWithNewAccount, openProfile, switchIdentity } from './test-utils';

const PB_URL = process.env.PUBLIC_POCKETBASE_URL || 'http://localhost:8090';

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
     // Nobody has paid yet: Alice can be removed, from her sheet.
     await page.locator('[data-is-me="false"]', { hasText: 'Alice' }).click();
     await expect(page.getByRole('dialog').getByRole('button', { name: /delete participant/i })).toBeVisible();
  });

  test('Renames a member', async ({ page }) => {
     await page.getByPlaceholder('New name').fill('Alcie');
     await page.getByRole('button', { name: /add/i }).click();
     await page.locator('[data-participant-id]', { hasText: 'Alcie' }).click();

     const sheet = page.getByRole('dialog');
     await sheet.getByLabel('Name').fill('Alice');
     await sheet.getByRole('button', { name: 'Save' }).click();
     await expect(page.locator('[data-participant-id]', { hasText: 'Alice' })).toBeVisible();
     await expect(page.getByText('Alcie')).toHaveCount(0);
  });

  test('Merges a member added twice, balances unchanged', { tag: '@chromium-only' }, async ({ page }) => {
     const base = page.url().replace(/\/members$/, '');
     for (const name of ['Bob', 'Bob M.']) {
         await page.getByPlaceholder('New name').fill(name);
         await page.getByRole('button', { name: /add/i }).click();
         await expect(page.locator('[data-participant-id]', { hasText: name })).toBeVisible();
     }

     // 30 for the three of us: Bob, counted twice, owes 20 in all.
     await page.goto(base);
     await page.getByRole('link', { name: /add expense/i }).click();
     await page.getByPlaceholder('What was it for?').fill('Dinner');
     await page.getByPlaceholder('0.00').fill('30');
     await page.getByRole('button', { name: /save expense/i }).first().click();
     await expect(page.getByText('Dinner')).toBeVisible();

     await page.goto(`${base}/members`);
     await page.locator('[data-participant-id]', { hasText: 'Bob M.' }).click();
     await page.getByRole('dialog').getByRole('button', { name: 'Bob', exact: true }).click();
     await page.getByRole('dialog').getByRole('button', { name: 'Merge' }).click();
     await expect(page.getByText('Merged into Bob')).toBeVisible();
     await expect(page.locator('[data-participant-id]', { hasText: 'Bob M.' })).toHaveCount(0);

     await page.goto(`${base}/balance`);
     await expect(page.getByText('You are owed')).toBeVisible();
     await expect(page.getByText('€20.00').first()).toBeVisible();
  });

  test('Changes the group currency, converting the amounts', { tag: '@chromium-only' }, async ({ page }) => {
     // 1 EUR = 2 USD today.
     await page.route(/currency-api/, (route) => route.fulfill({ json: { eur: { eur: 1, usd: 2 } }, headers: { 'access-control-allow-origin': '*' } }));
     // Not the real rates fetched (and cached) while the group was created.
     await page.addInitScript(() => Object.keys(localStorage).filter((k) => k.startsWith('kimpay_rates_')).forEach((k) => localStorage.removeItem(k)));
     await page.reload();
     const base = page.url().replace(/\/members$/, '');
     await page.getByPlaceholder('New name').fill('Bob');
     await page.getByRole('button', { name: /add/i }).click();
     await expect(page.locator('[data-participant-id]', { hasText: 'Bob' })).toBeVisible();

     await page.goto(base);
     await page.getByRole('link', { name: /add expense/i }).click();
     await page.getByPlaceholder('What was it for?').fill('Dinner');
     await page.getByPlaceholder('0.00').fill('30');
     await page.getByRole('button', { name: /save expense/i }).first().click();
     await expect(page.getByText('Dinner')).toBeVisible();

     await page.getByRole('navigation').getByRole('link', { name: 'Group', exact: true }).click();
     await page.getByRole('button', { name: 'Edit' }).click();
     const sheet = page.getByRole('dialog');
     await sheet.getByRole('button', { name: 'Currency' }).click();
     await sheet.getByRole('option', { name: /USD/ }).click();
     await sheet.getByRole('button', { name: 'Save' }).click();

     const confirm = page.getByRole('dialog', { name: 'Switch the Kimpay to USD?' });
     await expect(confirm.getByText(/1 EUR = 2 USD/)).toBeVisible();
     const changed = page.waitForResponse((r) => r.url().endsWith('/currency'));
     await confirm.getByRole('button', { name: 'Convert to USD' }).click();
     const response = await changed;
     expect(response.status(), await response.text()).toBe(200);
     await expect(page.getByText(/^USD ·/)).toBeVisible();

     // Owed 15 EUR, now 30 USD; the expense keeps its 30 EUR.
     await page.goto(`${base}/balance`);
     await expect(page.getByText('You are owed')).toBeVisible();
     await expect(page.getByText('$30.00').first()).toBeVisible();
  });

  test('Offers an existing member with the same first name', async ({ page }) => {
     await page.getByPlaceholder('New name').fill('Alice');
     await page.getByRole('button', { name: /add/i }).click();
     await expect(page.locator('[data-participant-id]', { hasText: 'Alice' })).toBeVisible();

     await openProfile(page);
     await page.getByRole('button', { name: "That's not me" }).click();
     const dialog = page.getByRole('dialog', { name: 'Who are you?' });
     await dialog.getByPlaceholder('Your name').fill('alice');
     await expect(dialog.getByText('Is that you, Alice?')).toBeVisible();
     await dialog.getByRole('button', { name: "Yes, that's me" }).click();
     await expect(dialog).toBeHidden();
     await expect(page.locator('[data-participant-id]', { hasText: 'Alice' })).toHaveAttribute('data-is-me', 'true');
  });

  test('Tells a creator without an account how to delete the group', async ({ page }) => {
     await page.getByRole('navigation').getByRole('link', { name: 'Group', exact: true }).click();
     await expect(page.getByRole('button', { name: /delete kimpay/i })).toContainText('Create a free account');
  });

  test('Lets the creator delete the group once logged in on this device', { tag: '@chromium-only' }, async ({ page, request }) => {
     await page.getByRole('navigation').getByRole('link', { name: 'Group', exact: true }).click();
     const kimpayId = new URL(page.url()).pathname.split('/')[2];
     // The account claims the creator and, with this device's creator key,
     // becomes the group's owner.
     const owned = page.waitForResponse((r) => r.url().includes('/own') && r.request().method() === 'POST');
     await loginWithNewAccount(page, request, 'Admin');
     expect((await owned).ok()).toBe(true);

     await page.getByRole('button', { name: /delete kimpay/i }).click();
     await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
     await expect(page).toHaveURL(/\/$/);
     const gone = await request.get(`${PB_URL}/api/kimpay/${kimpayId}/data`);
     expect(gone.status()).toBe(404);
  });

  test('Archives the Kimpay from its settings, and unarchives it', async ({ page }) => {
     await page.getByRole('navigation').getByRole('link', { name: 'Group', exact: true }).click();
     await expect(page).toHaveURL(/\/settings$/);
     const settings = page.url();
     await page.getByRole('button', { name: /^archive kimpay/i }).click();
     await expect(page.getByText('Settings Test Group archived')).toBeVisible();
     await expect(page).toHaveURL(/\/$/);
     await expect(page.getByRole('button', { name: 'Archived (1)' })).toBeVisible();

     await page.goto(settings);
     await page.getByRole('button', { name: /^unarchive kimpay/i }).click();
     await expect(page.getByRole('button', { name: /^archive kimpay/i })).toBeVisible();
     await page.goto('/');
     await expect(page.getByRole('button', { name: /Archived/ })).toBeHidden();
  });

  test('Verify Offline Buttons (Online Mode)', async ({ page }) => {
    await page.getByRole('navigation').getByRole('link', { name: 'Group', exact: true }).click();
    // Ensure critical buttons are enabled when online
    const leaveBtn = page.getByRole('button', { name: /leave kimpay/i });
    await expect(leaveBtn).toBeEnabled();

    const deleteBtn = page.getByRole('button', { name: /delete kimpay/i });
    if (await deleteBtn.isVisible()) {
        await expect(deleteBtn).toBeEnabled();
    }
  });

  test('Opens the profile from its shortcut', async ({ page }) => {
     // From my own row of the participants list
     await page.locator('[data-is-me="true"]').click();
     await page.getByRole('dialog').getByRole('button', { name: 'My profile' }).click();
     // A guest's profile: who I am here, and my payment links (an account needed).
     await expect(page.getByRole('button', { name: "That's not me" })).toBeVisible();
     await expect(page.getByRole('button', { name: /my payment links/i })).toBeVisible();
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
     const newAliceRow = page.locator('[data-participant-id]', { has: page.getByText('Alice') });

     // Wait for the attribute to update (reactivity)
     await expect(newAliceRow).toHaveAttribute('data-is-me', 'true', { timeout: 15000 });
     await expect(newAliceRow.getByText(/you|vous/i)).toBeVisible();

     const adminRow = page.locator('[data-participant-id]', { has: page.getByText('Admin') });
     await expect(adminRow).toHaveAttribute('data-is-me', 'false');
     await expect(adminRow.getByText(/you|vous/i)).not.toBeVisible();
  });

});
