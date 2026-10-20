import { test, expect, type Page } from '@playwright/test';
import { createKimpay, dismissInstallPrompt } from './test-utils';

async function openMembers(page: Page) {
    await page.getByRole('navigation').getByRole('link', { name: 'Members' }).click();
    await expect(page).toHaveURL(/\/members$/);
}

async function addMember(page: Page, name: string) {
    await page.getByPlaceholder('New name').fill(name);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText(`${name} added`)).toBeVisible();
}

/** An expense Alice paid for everyone ticked by default, then the list. */
async function addExpense(page: Page, description: string, amount: string) {
    await page.getByRole('link', { name: /add expense/i }).click();
    await page.getByPlaceholder('What was it for?').fill(description);
    await page.getByPlaceholder('0.00').fill(amount);
    await page.getByRole('button', { name: /save/i }).first().click();
    await expect(page).not.toHaveURL(/\/add$/);
    await page.getByRole('navigation').getByRole('link', { name: 'Expenses' }).click();
    await expect(page).toHaveURL(/\/k\/[a-z0-9]+\/?$/);
}

const row = (page: Page, name: string) => page.locator('[data-participant-id]', { hasText: name });

test.describe('Members', () => {
    test.beforeEach(async ({ page }) => {
        await createKimpay(page, 'Members Test', 'Alice');
        await dismissInstallPrompt(page);
        await openMembers(page);
    });

    test('a name not here yet gets a link of their own', async ({ page, browser }) => {
        await addMember(page, 'Bob');
        const bob = row(page, 'Bob');
        await expect(bob).toHaveAttribute('data-joined', 'false');
        await expect(bob.getByText('Not here yet')).toBeVisible();
        await expect(page.getByText('2 members · 1 joined')).toBeVisible();

        // More than one member: inviting is a row of the list, the big button is gone.
        await expect(page.getByRole('button', { name: 'Invite', exact: true })).toHaveCount(1);

        await bob.getByRole('button', { name: 'Invite Bob' }).click();
        const sheet = page.getByRole('dialog', { name: 'Invite Bob' });
        const link = (await sheet.locator('.font-mono').textContent())!;
        expect(link).toMatch(/\/k\/[a-zA-Z0-9]+\?as=[a-z0-9]{15}$/);
        await page.keyboard.press('Escape');

        // Bob opens it: his name is suggested, and the link is not kept.
        const other = await (await browser.newContext()).newPage();
        await other.goto(link);
        const identity = other.getByRole('dialog');
        await expect(identity.getByText('Are you Bob?')).toBeVisible();
        await identity.getByRole('button', { name: 'Yes, continue' }).click();
        await expect(identity).toBeHidden();
        await expect(other).not.toHaveURL(/as=/);

        // Alice sees him joined.
        await expect(bob).toHaveAttribute('data-joined', 'true', { timeout: 10000 });
        await expect(bob.getByText('Joined')).toBeVisible();
        await expect(page.getByText('2 members')).toBeVisible();
    });

    test('someone else than the name suggested picks theirs', async ({ page, browser }) => {
        await addMember(page, 'Bob');
        await row(page, 'Bob').getByRole('button', { name: 'Invite Bob' }).click();
        const link = (await page.getByRole('dialog', { name: 'Invite Bob' }).locator('.font-mono').textContent())!;

        const other = await (await browser.newContext()).newPage();
        await other.goto(link);
        const identity = other.getByRole('dialog');
        await identity.getByRole('button', { name: "No, I'm someone else" }).click();
        await expect(identity.getByRole('heading', { name: 'Who are you?' })).toBeVisible();
    });

    test('the sheet of a member says where they stand and leads to their expenses', async ({ page }) => {
        await addMember(page, 'Bob');
        await addExpense(page, 'Groceries', '30');

        // Owed money: nothing to do, no card above the list.
        await expect(page.getByTestId('list-summary')).toHaveCount(0);

        await openMembers(page);
        await row(page, 'Bob').click();
        const sheet = page.getByRole('dialog', { name: 'Bob' });
        const stats = sheet.getByTestId('member-stats');
        await expect(stats.getByText('€0.00', { exact: true })).toBeVisible();
        await expect(stats.getByText('€15.00', { exact: true })).toBeVisible();
        await expect(stats.getByText('−€15.00', { exact: true })).toBeVisible();
        await expect(sheet.getByTestId('debt-card')).toContainText('Bob owes you');
        await expect(sheet.getByTestId('debt-card')).toContainText('€15.00');

        // Recorded from here: settled.
        await sheet.getByRole('button', { name: 'Mark as paid back' }).click();
        const settle = page.getByRole('dialog', { name: 'Record a reimbursement' });
        await settle.getByRole('button', { name: 'Record' }).click();
        await expect(settle).toBeHidden();

        await row(page, 'Bob').click();
        await expect(sheet.getByTestId('debt-card')).toHaveCount(0);
        await sheet.getByRole('button', { name: 'See their expenses (2)' }).click();
        await expect(page).toHaveURL(/\/k\/[a-zA-Z0-9]+$/);
        await expect(page.getByRole('button', { name: 'Person' })).toContainText('Bob');
        await expect(page.getByText('Groceries')).toBeVisible();
    });

    test('a member who left is no longer ticked in new expenses', async ({ page }) => {
        await addMember(page, 'Bob');
        await addMember(page, 'Carol');
        await row(page, 'Carol').click();
        const sheet = page.getByRole('dialog', { name: 'Carol' });
        await sheet.getByRole('button', { name: /^In new expenses/ }).click();
        const include = sheet.getByRole('switch', { name: 'Ticked by default' });
        await include.click();
        await expect(include).toHaveAttribute('aria-checked', 'false');
        await page.keyboard.press('Escape');
        await expect(row(page, 'Carol').getByText('No longer taking part')).toBeVisible();

        await page.getByRole('link', { name: /add expense/i }).click();
        await page.getByRole('button', { name: /^for whom/i }).click();
        const forWhom = page.getByRole('group', { name: 'For whom' });
        await expect(forWhom.getByRole('button', { name: 'Bob' })).toHaveAttribute('aria-pressed', 'true');
        await expect(forWhom.getByRole('button', { name: 'Carol' })).toHaveAttribute('aria-pressed', 'false');
    });

    test('a couple counting as two is split by shares in new expenses', async ({ page }) => {
        await addMember(page, 'Bob');
        await row(page, 'Bob').click();
        const sheet = page.getByRole('dialog', { name: 'Bob' });
        await sheet.getByRole('button', { name: /^In new expenses/ }).click();
        await sheet.getByRole('button', { name: 'One share more' }).click();
        await expect(sheet.getByTestId('member-shares')).toHaveText('2');
        await page.keyboard.press('Escape');
        await expect(row(page, 'Bob').getByText('2 shares')).toBeVisible();

        await page.getByRole('link', { name: /add expense/i }).click();
        await page.getByRole('button', { name: /^split by shares/i }).click();
        await expect(page.getByRole('radio', { name: 'Shares' })).toHaveAttribute('aria-checked', 'true');
        await expect(page.getByLabel('Share of Bob')).toHaveValue('2');
        await expect(page.getByLabel('Share of Alice')).toHaveValue('1');

        // In the history.
        await page.goto(page.url().replace(/\/add$/, '/settings/activity'));
        await expect(page.getByText('Shares: 1 → 2')).toBeVisible();
    });
});
