import { test, expect } from '@playwright/test';
import { createKimpay, dismissInstallPrompt } from './test-utils';

const PB_URL = process.env.PUBLIC_POCKETBASE_URL || 'http://localhost:8090';

test('A group of more than 1000 expenses is loaded whole', { tag: '@chromium-only' }, async ({ page, request }) => {
    test.setTimeout(120_000);

    await createKimpay(page, 'Big Group', 'Olivia');
    await dismissInstallPrompt(page);
    const groupUrl = page.url();
    const kimpayId = new URL(groupUrl).pathname.split('/')[2]!;
    const group = await (await request.get(`${PB_URL}/api/kimpay/${kimpayId}/data`)).json();
    const payer = group.expand.participants_via_kimpay[0].id;

    // Away from the group meanwhile: each creation would trigger a refetch.
    await page.goto('about:blank');
    const total = 1001;
    for (let start = 0; start < total; start += 50) {
        await Promise.all(
            Array.from({ length: Math.min(50, total - start) }, async (_, i) => {
                const response = await request.post(`${PB_URL}/api/collections/expenses/records`, {
                    data: {
                        kimpay: kimpayId,
                        payer,
                        involved: [payer],
                        description: `Item ${start + i}`,
                        amount: 1,
                        currency: 'EUR',
                        date: '2026-01-01 12:00:00.000Z',
                    },
                });
                expect(response.ok()).toBe(true);
            }),
        );
    }

    // The group view gets all of them (a back-relation expand stops at 1000).
    const data = page.waitForResponse((r) => r.url().includes(`/api/kimpay/${kimpayId}/data`));
    await page.goto(groupUrl);
    const body = await (await data).json();
    expect(body.expand.expenses_via_kimpay).toHaveLength(total);
});
