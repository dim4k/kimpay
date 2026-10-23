import { test, expect, type Page } from '@playwright/test';
import { createKimpay, dismissInstallPrompt, expenseSheet, loginWithNewAccount, openProfile, switchIdentity } from './test-utils';

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
    await expect(expenseSheet(page)).toBeHidden();
    await expect(page.getByText(description)).toBeVisible();
}

test.describe('Splits, money received, filters, read-only link', () => {
    test('Splits an expense by shares', async ({ page }) => {
        const base = await setupGroup(page, 'Shares Test');

        await addExpense(page, base, 'Cabin', '90', async () => {
            await page.getByRole('button', { name: /split equally/i }).click();
            await page.getByRole('radio', { name: 'Shares' }).click();
            await page.getByLabel('Share of Other').fill('2');
            await page.getByRole('button', { name: 'Back' }).click();
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

        await expect(page.getByText('€10.00 left to assign').filter({ visible: true })).toBeVisible();
        await page.getByRole('button', { name: 'Back' }).click();
        await expect(page.getByRole('button', { name: /save expense/i }).first()).toBeDisabled();
    });

    test('Shares money received back with the group', async ({ page }) => {
        const base = await setupGroup(page, 'Income Test');

        await addExpense(page, base, 'Flat', '100');
        await addExpense(page, base, 'Deposit back', '40', async () => {
            await page.getByRole('radio', { name: 'Money in' }).click();
        });
        // The line says what it is.
        await expect(page.locator('[data-expense]', { hasText: 'Deposit back' }).getByText('Money in', { exact: true })).toBeVisible();
        await expect(page.locator('[data-expense]', { hasText: 'Flat' }).getByText('Money in', { exact: true })).toHaveCount(0);

        // Other owes 50 for the flat, minus their 20 of the deposit Payer received.
        await page.getByRole('navigation').getByRole('link', { name: /balance/i }).click();
        await expect(page.getByText('€30.00').first()).toBeVisible();
    });

    test('Records a reimbursement from the form, with the suggested amount', async ({ page }) => {
        const base = await setupGroup(page, 'Payback Test');
        await addExpense(page, base, 'Hotel', '100');

        // Other owes 50: recorded from the form, as a reimbursement to Payer.
        await switchIdentity(page, 'Other');
        await page.getByRole('link', { name: /add expense/i }).click();
        const sheet = expenseSheet(page);
        await sheet.getByRole('radio', { name: 'Reimbursement' }).click();
        await expect(sheet.getByPlaceholder('What was it for?')).toBeHidden();
        await expect(sheet.getByRole('button', { name: /^From/ })).toContainText('Other');
        await expect(sheet.getByRole('button', { name: /^To/ })).toContainText('Payer');
        await sheet.getByRole('button', { name: 'Use €50.00' }).click();
        await expect(sheet.getByText('Balances after: You €0.00 · Payer €0.00')).toBeVisible();
        await sheet.getByRole('button', { name: 'Record the reimbursement' }).click();
        await expect(sheet).toBeHidden();

        // Titled by who paid whom, its type under it.
        const line = page.locator('[data-expense]', { hasText: 'You → Payer' });
        await expect(line.getByText('Reimbursement', { exact: true })).toBeVisible();
        await page.getByRole('navigation').getByRole('link', { name: /balance/i }).click();
        await expect(page.getByText(/all settled/i).first()).toBeVisible();
    });

    test('Searches and filters the expense list', async ({ page, isMobile }) => {
        const base = await setupGroup(page, 'Filter Test');
        await addExpense(page, base, 'Taxi ride', '12');
        await addExpense(page, base, 'Dinner', '40');

        await page.getByPlaceholder('Search').fill('TAXI');
        await expect(page.getByText('Taxi ride')).toBeVisible();
        await expect(page.getByText('Dinner')).toBeHidden();
        await expect(page.getByText('1 result')).toBeVisible();

        await page.getByRole('button', { name: 'Clear' }).click();
        await expect(page.getByText('Dinner')).toBeVisible();

        // Computers show the filters without asking.
        if (isMobile) await page.getByRole('button', { name: 'Filters' }).click();
        await page.getByRole('button', { name: 'Type' }).click();
        await page.getByRole('option', { name: 'Money received' }).click();
        await expect(page.getByText('No matching expenses.')).toBeVisible();
    });

    test('Payment links need an account, and stay private until shown in a group', async ({ page, request }) => {
        const base = await setupGroup(page, 'Private Links');
        const needsAccount = page.getByText('Create a free account to show your payment links');

        // A guest is asked for an account first (anyone with the link could
        // change a guest's links): nothing to show yet.
        await openProfile(page);
        await expect(page.getByRole('switch', { name: 'Show my payment links here' })).toHaveCount(0);
        await page.getByRole('button', { name: /my payment links/i }).click();
        await expect(needsAccount).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(needsAccount).toBeHidden();

        // Someone owes me: the card offers the same.
        await addExpense(page, base, 'Groceries', '40');
        await page.goto(`${base}/balance`);
        await page.getByRole('button', { name: 'Add a payment link' }).click();
        await expect(needsAccount).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(needsAccount).toBeHidden();

        // "Later" hides the card for good.
        await page.getByRole('button', { name: 'Later' }).click();
        await expect(page.getByText('Help Other pay you')).toBeHidden();
        await page.reload();
        await expect(page.getByText('You are owed')).toBeVisible();
        await expect(page.getByText('Help Other pay you')).toBeHidden();

        // Logged in: entered in the profile, not shown in the group yet; then
        // shown from the profile switch.
        await loginWithNewAccount(page, request, 'Payer');
        await openProfile(page);
        await page.getByRole('button', { name: /my payment links/i }).click();
        await page.getByLabel('Revolut.me').fill('payer.rev');
        await page.getByRole('button', { name: /^save$/i }).click();
        await expect(page.getByRole('dialog', { name: 'My payment links' })).toBeHidden();
        const showHere = page.getByRole('switch', { name: 'Show my payment links here' });
        await expect(showHere).not.toBeChecked();
        await showHere.click();
        await expect(page.getByText('Your payment links are visible in this Kimpay')).toBeVisible();
    });

    test('Back from a payment link, asks whether it was paid', async ({ page, request }) => {
        const base = await setupGroup(page, 'Paid Back');
        await addExpense(page, base, 'Concert', '60');
        await loginWithNewAccount(page, request, 'Payer');

        // Payer shows a PayPal link; Other, who owes 30, pays with it.
        await page.goto(`${base}/balance`);
        await page.getByRole('button', { name: 'Add a payment link' }).click();
        await page.getByLabel('PayPal.me').fill('payer.pp');
        await page.getByRole('button', { name: /^save$/i }).click();
        await expect(page.getByText('Your payment links are visible in this Kimpay')).toBeVisible();
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
        await dialog.getByRole('button', { name: "Yes, it's paid back" }).click();
        await expect(page.getByText(/all settled/i).first()).toBeVisible();
    });

    test('Shares a read-only summary, without payment links', async ({ page, request }) => {
        const base = await setupGroup(page, 'Readonly Test');
        await addExpense(page, base, 'Museum', '100');
        await loginWithNewAccount(page, request, 'Payer');

        // Payer is owed money: Balance offers to add a payment link and show it here.
        await page.goto(`${base}/balance`);
        await expect(page.getByText('Help Other pay you')).toBeVisible();
        await page.getByRole('button', { name: 'Add a payment link' }).click();
        await page.getByLabel('PayPal.me').fill('https://paypal.me/payer.pp');
        await page.getByRole('button', { name: /^save$/i }).click();
        await expect(page.getByText('Your payment links are visible in this Kimpay')).toBeVisible();
        await expect(page.getByText('Help Other pay you')).toBeHidden();

        // The profile keeps the link (cleaned up) and shows it in this group.
        await openProfile(page);
        await expect(page.getByRole('switch', { name: 'Show my payment links here' })).toBeChecked();
        await page.getByRole('button', { name: /my payment links/i }).click();
        await expect(page.getByLabel('PayPal.me')).toHaveValue('payer.pp');
        await page.getByRole('dialog', { name: 'My payment links' }).locator('header').getByRole('button', { name: 'Close' }).click();

        // The read-only link is a setting of the Kimpay, in its own sheet.
        await page.goto(`${base}/settings`);
        await page.getByRole('button', { name: /Read-only link/ }).click();
        await page.getByRole('dialog', { name: 'Read-only link' }).getByRole('button', { name: 'Create the link' }).click();
        const link = page.locator('span.font-mono', { hasText: '/r/' });
        await expect(link).toBeVisible();
        const url = (await link.textContent())!.trim();
        expect(url).not.toContain(base.split('/k/')[1]!);

        const summary = page.waitForResponse((r) => r.url().includes('/api/readonly/'));
        await page.goto(url);
        // The summary never reveals the group ID (a write capability), nor payment handles.
        const body = await (await summary).text();
        expect(body).not.toContain(base.split('/k/')[1]!);
        expect(body).not.toContain('payer.pp');
        await expect(page.getByRole('heading', { name: 'Readonly Test' })).toBeVisible();
        await expect(page.getByText('Read only')).toBeVisible();
        await expect(page.getByText('Museum')).toBeVisible();
        // The lines open their details, without any action.
        await page.getByRole('button', { name: /Museum/ }).click();
        await expect(page.getByRole('dialog', { name: 'Museum' }).locator('dt', { hasText: /^Date$/ })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
        // A summary is for reading: no payment buttons.
        await expect(page.getByRole('link', { name: /pay payer with paypal/i })).toHaveCount(0);

        // Once disabled, the link stops working.
        await page.goto(`${base}/settings`);
        await page.getByRole('button', { name: /Read-only link/ }).click();
        await page.getByRole('dialog', { name: 'Read-only link' }).getByRole('button', { name: 'Disable the link' }).click();
        await page.getByRole('dialog', { name: 'Disable the read-only link?' }).getByRole('button', { name: 'Disable the link' }).click();
        await page.goto(url);
        await expect(page.getByText('Link unavailable')).toBeVisible();
    });
});
