import type { Expense, Kimpay, Participant } from '#lib/types.js';
import type { TranslationKey } from '#lib/i18n.js';
import { DEFAULT_CURRENCY } from '#lib/services/currency.js';
import { DEFAULT_EXPENSE_EMOJI } from '#lib/constants.js';
import { parseLocalISODate, toLocalISODate } from '#lib/utils/date.js';

export type ExportFormat = 'csv' | 'md';

export interface ExportInput {
    kimpay: Kimpay;
    expenses: Expense[];
    participants: Participant[];
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

function rows({ expenses, participants, t, locale }: ExportInput) {
    const names = new Map(participants.map((p) => [p.id, p.name]));
    const nameOf = (id: string) => names.get(id) || t('common.unknown');
    return expenses.map((e) => ({
        icon: e.icon || DEFAULT_EXPENSE_EMOJI,
        date: parseLocalISODate(e.date).toLocaleDateString(locale),
        description: e.description || '',
        amount: e.amount.toFixed(2),
        currency: e.currency || DEFAULT_CURRENCY,
        payer: e.expand?.payer?.name || nameOf(e.payer),
        involved: (e.involved || []).map(nameOf),
    }));
}

export function toCsv(input: ExportInput): string {
    const { t } = input;
    const header = [
        t('export.col.date'),
        t('export.col.desc'),
        t('export.col.amount'),
        t('export.col.currency'),
        t('export.col.payer'),
        t('export.col.for'),
    ];
    const lines = rows(input).map((r) =>
        [r.date, r.description, r.amount, r.currency, r.payer, r.involved.join('; ')].map(csvField).join(','),
    );
    return [header.map(csvField).join(','), ...lines].join('\n') + '\n';
}

export function toMarkdown(input: ExportInput, date = new Date()): string {
    const { kimpay, participants, t, locale } = input;
    const lines = [
        `# ${kimpay.icon || ''} ${kimpay.name}`,
        '',
        `**${t('export.meta.date')}:** ${date.toLocaleDateString(locale)}`,
        `**${t('export.meta.participants')}:** ${participants.map((p) => p.name).join(', ')}`,
        '',
        `## ${t('export.meta.expenses')}`,
        '',
        `| ${t('export.col.icon')} | ${t('export.col.date')} | ${t('export.col.desc')} | ${t('export.col.amount')} | ${t('export.col.payer')} | ${t('export.col.for')} |`,
        '|:---:|---|---|---|---|---|',
        ...rows(input).map((r) =>
            `| ${r.icon} | ${r.date} | ${mdCell(r.description)} | ${r.amount} ${r.currency} | ${mdCell(r.payer)} | ${mdCell(r.involved.join(', '))} |`,
        ),
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
