import { describe, it, expect } from 'vitest';
import { toCsv, toMarkdown, exportFilename, type ExportInput } from '../../src/lib/utils/export';
import type { Expense, Kimpay, Participant } from '../../src/lib/types';

const t = ((key: string) => key) as ExportInput['t'];

const kimpay = {
    id: 'kimpay000000001',
    collectionId: 'kimpays',
    collectionName: 'kimpays',
    created: '',
    updated: '',
    name: 'Trip to Lisbon!',
    icon: '✈️',
    currency: 'EUR',
    created_by: 'p1',
} as Kimpay;

const participant = (id: string, name: string) => ({ id, name } as Participant);

const expense = (overrides: Partial<Expense>): Expense => ({
    id: 'e1',
    collectionId: 'expenses',
    collectionName: 'expenses',
    created: '',
    updated: '',
    amount: 12.5,
    description: 'Dinner',
    date: '2026-01-15 00:00:00.000Z',
    payer: 'p1',
    involved: ['p1', 'p2'],
    kimpay: kimpay.id,
    created_by: 'p1',
    is_reimbursement: false,
    currency: 'EUR',
    ...overrides,
});

const input = (expenses: Expense[]): ExportInput => ({
    kimpay,
    expenses,
    participants: [participant('p1', 'Alice'), participant('p2', 'Bob, Jr.')],
    rates: {},
    t,
    locale: 'en-US',
});

describe('utils/export', () => {
    it('builds a safe, dated file name', () => {
        expect(exportFilename(kimpay, 'csv', new Date(2026, 0, 15))).toBe('kimpay_trip_to_lisbon__2026-01-15.csv');
    });

    it('exports one CSV line per expense, with its currency', () => {
        const [table] = toCsv(input([expense({}), expense({ amount: 3, currency: 'USD', exchange_rate: 0.9 })])).split('\n\n');
        const lines = table!.split('\n');

        expect(lines[0]).toBe('export.col.date,export.col.desc,export.col.amount,export.col.currency,export.col.payer,export.col.for,export.col.type,export.col.note');
        expect(lines).toHaveLength(3);
        expect(lines[1]).toBe('1/15/2026,Dinner,12.50,EUR,Alice,"Alice; Bob, Jr.",export.type.expense,');
        expect(lines[2]).toContain(',3.00,USD,');
    });

    it('shows each share of a custom split, and the line type', () => {
        const csv = toCsv(input([
            expense({ amount: 30, split: { mode: 'shares', values: { p1: 2, p2: 1 } } }),
            expense({ amount: 10, is_income: true }),
        ]));

        expect(csv).toContain(',30.00,EUR,Alice,"Alice (20.00); Bob, Jr. (10.00)",export.type.expense');
        expect(csv).toContain(',10.00,EUR,Alice,"Alice; Bob, Jr.",export.type.income');
    });

    it('ends the CSV with the balances and the suggested payments', () => {
        const sections = toCsv(input([expense({ amount: 30 })])).trim().split('\n\n');

        expect(sections).toHaveLength(3);
        expect(sections[1]).toBe(['export.meta.balances,EUR', 'export.col.participant,export.col.balance', 'Alice,15.00', '"Bob, Jr.",-15.00'].join('\n'));
        expect(sections[2]).toBe(['export.meta.transfers,EUR', 'export.col.from,export.col.to,export.col.amount', '"Bob, Jr.",Alice,15.00'].join('\n'));
    });

    it('exports the note, on one line in Markdown', () => {
        const note = 'Deposit,\nthe rest on arrival';
        expect(toCsv(input([expense({ notes: note })]))).toContain(',export.type.expense,"Deposit,\nthe rest on arrival"');
        expect(toMarkdown(input([expense({ notes: note })]))).toContain('| export.type.expense | Deposit, the rest on arrival |');
    });

    it('quotes CSV fields containing separators or quotes', () => {
        const csv = toCsv(input([expense({ description: 'Pizza, "XL"', payer: 'p2' })]));

        expect(csv).toContain('"Pizza, ""XL""",12.50,EUR,"Bob, Jr."');
    });

    it('exports a Markdown table without breaking cells', () => {
        const md = toMarkdown(input([expense({ description: 'A | B' })]), new Date(2026, 0, 15));

        expect(md).toContain('# ✈️ Trip to Lisbon!');
        expect(md).toContain('**export.meta.participants:** Alice, Bob, Jr.');
        expect(md).toContain('| A - B | 12.50 EUR | Alice | Alice, Bob, Jr. | export.type.expense |');
        expect(md).toContain('## export.meta.balances (EUR)');
        expect(md).toContain('| Bob, Jr. | Alice | 6.25 |');
    });

    it('says when everything is settled in Markdown', () => {
        expect(toMarkdown(input([]))).toContain('export.meta.settled');
    });

    it('falls back to "unknown" for deleted participants', () => {
        const csv = toCsv(input([expense({ payer: 'gone', involved: ['gone'] })]));

        expect(csv).toContain(',common.unknown,common.unknown');
    });
});
