import { test, expect, type Page } from '@playwright/test';
import { createKimpay, dismissInstallPrompt, openProfile, switchIdentity } from './test-utils';

/** Group of two: "Payer" (this device) and "Other". */
async function setupGroup(page: Page, name: string) {
    await createKimpay(page, name, 'Payer');
    await dismissInstallPrompt(page);
    const base = page.url().replace(/\/$/, '');
    await page.goto(`${base}/members`);
    await page.getByPlaceholder('New name').fill('Other');
    await page.getByRole('button', { name: /^add$/i }).click();
    await expect(page.getByText('Other', { exact: true })).toBeVisible();
    return base;
}

async function addExpense(page: Page, base: string, description: string, amount: string, fill?: () => Promise<void>) {
    await page.goto(base);
    await page.getByRole('link', { name: /add expense/i }).click();
    await fill?.();
    await page.getByPlaceholder(/what was it for|deposit returned/i).fill(description);
    await page.getByPlaceholder('0.00').first().fill(amount);
    await page.getByRole('button', { name: /save expense/i }).first().click();
    await expect(page.getByText(description)).toBeVisible();
}

test.describe('Splits, money received, filters, read-only link', () => {
    test('Splits an expense by shares', async ({ page }) => {
        const base = await setupGroup(page, 'Shares Test');

        await addExpense(page, base, 'Cabin', '90', async () => {
            await page.getByRole('button', { name: /split equally/i }).click();
            await page.getByRole('radio', { name: 'Shares' }).click();
            await page.getByLabel('Share of Other').fill('2');
        });

        // Other has 2 shares out of 3: owes 60 to Payer.
        await page.getByRole('navigation').getByRole('link', { name: /balance/i }).click();
        await expect(page.getByText('€60.00').first()).toBeVisible();
    });

    test('Refuses exact amounts that do not add up', async ({ page }) => {
        await setupGroup(page, 'Amounts Test');
        await page.getByRole('link', { name: /expenses/i }).click();
        await page.getByRole('link', { name: /add expense/i }).click();

        await page.getByPlaceholder('What was it for?').fill('Groceries');
        await page.getByPlaceholder('0.00').first().fill('50');
        await page.getByRole('button', { name: /split equally/i }).click();
        await page.getByRole('radio', { name: 'Amounts' }).click();
        await page.getByLabel('Share of Payer').fill('10');
        await page.getByLabel('Share of Other').fill('30');

        await expect(page.getByText('€10.00 left to assign')).toBeVisible();
        await expect(page.getByRole('button', { name: /save expense/i }).first()).toBeDisabled();
    });

    test('Shares money received back with the group', async ({ page }) => {
        const base = await setupGroup(page, 'Income Test');

        await addExpense(page, base, 'Flat', '100');
        await addExpense(page, base, 'Deposit back', '40', async () => {
            await page.getByRole('switch', { name: 'Money received' }).click();
        });

        // Other owes 50 for the flat, minus their 20 of the deposit Payer received.
        await page.getByRole('navigation').getByRole('link', { name: /balance/i }).click();
        await expect(page.getByText('€30.00').first()).toBeVisible();
    });

    test('Searches and filters the expense list', async ({ page }) => {
        const base = await setupGroup(page, 'Filter Test');
        await addExpense(page, base, 'Taxi ride', '12');
        await addExpense(page, base, 'Dinner', '40');

        await page.getByPlaceholder('Search').fill('TAXI');
        await expect(page.getByText('Taxi ride')).toBeVisible();
        await expect(page.getByText('Dinner')).toBeHidden();
        await expect(page.getByText('1 result(s)')).toBeVisible();

        await page.getByRole('button', { name: 'Clear' }).click();
        await expect(page.getByText('Dinner')).toBeVisible();

        await page.getByRole('button', { name: 'Filters' }).click();
        await page.getByRole('button', { name: 'Type' }).click();
        await page.getByRole('button', { name: 'Money received' }).click();
        await expect(page.getByText('No matching expenses.')).toBeVisible();
    });

    test('Payment links stay private until shown in a group', async ({ page }) => {
        const base = await setupGroup(page, 'Private Links');

        // Entered in the profile: not shown in the group yet.
        await openProfile(page);
        await page.getByRole('button', { name: /my payment links/i }).click();
        await page.getByLabel('Revolut.me').fill('payer.rev');
        await page.getByRole('button', { name: /^save$/i }).click();
        await expect(page.getByRole('dialog', { name: 'My payment links' })).toBeHidden();
        await expect(page.getByRole('switch', { name: 'Show my payment links here' })).not.toBeChecked();

        // Someone owes me: the card offers to show them; "Later" hides it for good.
        await addExpense(page, base, 'Groceries', '40');
        await page.goto(`${base}/balance`);
        await expect(page.getByRole('button', { name: 'Show to this group' })).toBeVisible();
        await page.getByRole('button', { name: 'Later' }).click();
        await expect(page.getByText('Help Other pay you')).toBeHidden();
        await page.reload();
        await expect(page.getByText('You are owed')).toBeVisible();
        await expect(page.getByText('Help Other pay you')).toBeHidden();

        // Shown from the profile switch instead.
        await openProfile(page);
        await page.getByRole('switch', { name: 'Show my payment links here' }).click();
        await expect(page.getByText('Your payment links are visible in this group')).toBeVisible();
    });

    test('Back from a payment link, asks whether it was paid', async ({ page }) => {
        const base = await setupGroup(page, 'Paid Back');
        await addExpense(page, base, 'Concert', '60');

        // Payer shows a PayPal link; Other, who owes 30, pays with it.
        await page.goto(`${base}/balance`);
        await page.getByRole('button', { name: 'Add a payment link' }).click();
        await page.getByLabel('PayPal.me').fill('payer.pp');
        await page.getByRole('button', { name: /^save$/i }).click();
        await expect(page.getByText('Your payment links are visible in this group')).toBeVisible();
        await switchIdentity(page, 'Other');
        await expect(page.getByText('Show amounts in')).toBeVisible();

        const popup = page.waitForEvent('popup');
        await page.getByRole('link', { name: /paypal/i }).click();
        await (await popup).close();
        // Away in PayPal, then back in the app.
        await page.evaluate(() => {
            const set = (state: string) => {
                Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
                document.dispatchEvent(new Event('visibilitychange'));
            };
            set('hidden');
            set('visible');
        });

        const dialog = page.getByRole('dialog');
        await expect(dialog.getByText('Did you pay Payer?')).toBeVisible();
        await dialog.getByRole('button', { name: 'Yes, mark as settled' }).click();
        await expect(page.getByText(/all settled/i).first()).toBeVisible();
    });

    test('Shares a read-only summary with payment links', async ({ page }) => {
        const base = await setupGroup(page, 'Readonly Test');
        await addExpense(page, base, 'Museum', '100');

        // Payer is owed money: Balance offers to add a payment link and show it here.
        await page.goto(`${base}/balance`);
        await expect(page.getByText('Help Other pay you')).toBeVisible();
        await page.getByRole('button', { name: 'Add a payment link' }).click();
        await page.getByLabel('PayPal.me').fill('https://paypal.me/payer.pp');
        await page.getByRole('button', { name: /^save$/i }).click();
        await expect(page.getByText('Your payment links are visible in this group')).toBeVisible();
        await expect(page.getByText('Help Other pay you')).toBeHidden();

        // The profile keeps the link (cleaned up) and shows it in this group.
        await openProfile(page);
        await expect(page.getByRole('switch', { name: 'Show my payment links here' })).toBeChecked();
        await page.getByRole('button', { name: /my payment links/i }).click();
        await expect(page.getByLabel('PayPal.me')).toHaveValue('payer.pp');
        await page.getByRole('dialog', { name: 'My payment links' }).getByRole('button', { name: 'Cancel' }).click();

        // The read-only link is a setting of the group.
        await page.goto(`${base}/settings`);
        await page.getByRole('button', { name: 'Create the link' }).click();
        const link = page.locator('span.font-mono', { hasText: '/r/' });
        await expect(link).toBeVisible();
        const url = (await link.textContent())!.trim();
        expect(url).not.toContain(base.split('/k/')[1]!);

        const summary = page.waitForResponse((r) => r.url().includes('/api/readonly/'));
        await page.goto(url);
        // The summary never reveals the group ID (a write capability).
        expect(await (await summary).text()).not.toContain(base.split('/k/')[1]!);
        await expect(page.getByRole('heading', { name: 'Readonly Test' })).toBeVisible();
        await expect(page.getByText('Read only')).toBeVisible();
        await expect(page.getByText('Museum')).toBeVisible();
        // The lines open like in the app, without any action.
        await page.getByRole('button', { name: /Museum/ }).click();
        await expect(page.getByText('Date:')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
        await expect(page.getByRole('link', { name: /pay payer with paypal/i })).toHaveAttribute('href', 'https://paypal.me/payer.pp/50.00EUR');

        // Once disabled, the link stops working.
        await page.goto(`${base}/settings`);
        await page.getByRole('button', { name: 'Disable the link' }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Disable the link' }).click();
        await page.goto(url);
        await expect(page.getByText('Link unavailable')).toBeVisible();
    });
});
