import type { Expense, Kimpay, Participant } from '#lib/types.js';
import type { TranslationKey } from '#lib/i18n.js';
import { DEFAULT_CURRENCY } from '#lib/services/currency.js';
import { DEFAULT_EXPENSE_EMOJI } from '#lib/constants.js';
import { parseLocalISODate, toLocalISODate } from '#lib/utils/date.js';
import { calculateBalances, calculateDebts } from '#lib/balance.js';
import { currencyDecimals, expenseShares, isCustomSplit } from '#lib/split.js';

export type ExportFormat = 'csv' | 'md';

export interface ExportInput {
    kimpay: Kimpay;
    expenses: Expense[];
    participants: Participant[];
    /** Today's exchange rates (base EUR), for expenses without a frozen rate */
    rates: Record<string, number>;
    t: (key: TranslationKey) => string;
    locale: string;
}

/** `kimpay_<name>_<YYYY-MM-DD>.<format>`, safe as a file name. */
export function exportFilename(kimpay: Kimpay, format: ExportFormat, date = new Date()): string {
    const name = kimpay.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return `kimpay_${name}_${toLocalISODate(date)}.${format}`;
}

/** Quote a CSV field when needed (RFC 4180). */
function csvField(value: string): string {
    return /[",;\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Markdown table cells cannot contain pipes or line breaks. */
function mdCell(value: string): string {
    return value.replace(/\|/g, '-').replace(/\r?\n/g, ' ');
}

function fixed(amount: number, currency: string): string {
    return amount.toFixed(currencyDecimals(currency));
}

function typeKey(e: Expense): TranslationKey {
    if (e.is_reimbursement) return 'export.type.reimbursement';
    if (e.is_income) return 'export.type.income';
    return 'export.type.expense';
}

function rows({ expenses, participants, t, locale }: ExportInput) {
    const names = new Map(participants.map((p) => [p.id, p.name]));
    const ids = participants.map((p) => p.id);
    const nameOf = (id: string) => names.get(id) || t('common.unknown');
    return expenses.map((e) => {
        const currency = e.currency || DEFAULT_CURRENCY;
        // Each person's share, only when it is not an equal split.
        const shares = isCustomSplit(e) ? expenseShares(e, ids) : null;
        return {
            icon: e.icon || DEFAULT_EXPENSE_EMOJI,
            type: t(typeKey(e)),
            date: parseLocalISODate(e.date).toLocaleDateString(locale),
            description: e.is_reimbursement ? t('balance.reimbursement') : e.description || '',
            amount: fixed(e.amount, currency),
            currency,
            payer: e.expand?.payer?.name || nameOf(e.payer),
            involved: (e.involved || []).map((id) =>
                shares && shares[id] !== undefined ? `${nameOf(id)} (${fixed(shares[id]!, currency)})` : nameOf(id),
            ),
            notes: e.notes || '',
        };
    });
}

/** Net balance of each participant and the suggested payments, in the Kimpay currency. */
function summary({ kimpay, expenses, participants, rates, t }: ExportInput) {
    const currency = kimpay.currency || DEFAULT_CURRENCY;
    const balances = calculateBalances(expenses, participants, currency, rates);
    const nameOf = (id: string) => participants.find((p) => p.id === id)?.name || t('common.unknown');
    return {
        currency,
        balances: participants.map((p) => ({ name: p.name, amount: fixed(balances[p.id] ?? 0, currency) })),
        transfers: calculateDebts(expenses, participants, currency, rates).map((tx) => ({
            from: nameOf(tx.from),
            to: nameOf(tx.to),
            amount: fixed(tx.amount, currency),
        })),
    };
}

export function toCsv(input: ExportInput): string {
    const { t } = input;
    const line = (fields: string[]) => fields.map(csvField).join(',');
    const header = [
        t('export.col.date'),
        t('export.col.desc'),
        t('export.col.amount'),
        t('export.col.currency'),
        t('export.col.payer'),
        t('export.col.for'),
        t('export.col.type'),
        t('export.col.note'),
    ];
    const { currency, balances, transfers } = summary(input);
    return [
        line(header),
        ...rows(input).map((r) => line([r.date, r.description, r.amount, r.currency, r.payer, r.involved.join('; '), r.type, r.notes])),
        '',
        line([t('export.meta.balances'), currency]),
        line([t('export.col.participant'), t('export.col.balance')]),
        ...balances.map((b) => line([b.name, b.amount])),
        '',
        line([t('export.meta.transfers'), currency]),
        line([t('export.col.from'), t('export.col.to'), t('export.col.amount')]),
        ...transfers.map((tx) => line([tx.from, tx.to, tx.amount])),
    ].join('\n') + '\n';
}

export function toMarkdown(input: ExportInput, date = new Date()): string {
    const { kimpay, participants, t, locale } = input;
    const { currency, balances, transfers } = summary(input);
    const lines = [
        `# ${kimpay.icon || ''} ${kimpay.name}`,
        '',
        `**${t('export.meta.date')}:** ${date.toLocaleDateString(locale)}`,
        `**${t('export.meta.participants')}:** ${participants.map((p) => p.name).join(', ')}`,
        '',
        `## ${t('export.meta.expenses')}`,
        '',
        `| ${t('export.col.icon')} | ${t('export.col.date')} | ${t('export.col.desc')} | ${t('export.col.amount')} | ${t('export.col.payer')} | ${t('export.col.for')} | ${t('export.col.type')} | ${t('export.col.note')} |`,
        '|:---:|---|---|---|---|---|---|---|',
        ...rows(input).map((r) =>
            `| ${r.icon} | ${r.date} | ${mdCell(r.description)} | ${r.amount} ${r.currency} | ${mdCell(r.payer)} | ${mdCell(r.involved.join(', '))} | ${r.type} | ${mdCell(r.notes)} |`,
        ),
        '',
        `## ${t('export.meta.balances')} (${currency})`,
        '',
        `| ${t('export.col.participant')} | ${t('export.col.balance')} |`,
        '|---|---:|',
        ...balances.map((b) => `| ${mdCell(b.name)} | ${b.amount} |`),
        '',
        `## ${t('export.meta.transfers')} (${currency})`,
        '',
        ...(transfers.length
            ? [
                  `| ${t('export.col.from')} | ${t('export.col.to')} | ${t('export.col.amount')} |`,
                  '|---|---|---:|',
                  ...transfers.map((tx) => `| ${mdCell(tx.from)} | ${mdCell(tx.to)} | ${tx.amount} |`),
              ]
            : [t('export.meta.settled')]),
        '',
        '',
        t('export.footer'),
    ];
    return lines.join('\n') + '\n';
}

/** Make the browser download `content` as a file. */
export function downloadFile(content: string, filename: string, type: string): void {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}
