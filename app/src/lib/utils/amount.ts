/**
 * Typing a decimal number in a text field (decimal keyboard), the same way
 * everywhere: "," or "." as separator, digits only.
 */

/** Digits and one decimal separator, at most `maxDigits` before it and `maxDecimals` after. */
export function sanitizeDecimal(raw: string, maxDigits = 8, maxDecimals = 2): string {
    const text = raw.replace(/[^\d.,]/g, '');
    const sep = text.search(/[.,]/);
    if (sep === -1) return text.slice(0, maxDigits);
    return text.slice(0, sep).slice(0, maxDigits) + text[sep] + text.slice(sep + 1).replace(/[.,]/g, '').slice(0, maxDecimals);
}

/** The value of a sanitized field: 0 when empty. */
export function parseDecimal(text: string): number {
    return parseFloat(text.replace(',', '.')) || 0;
}

/** A value to show in such a field, with the decimal separator of the language. */
export function formatDecimal(value: number | undefined, locale: string): string {
    if (value === undefined || !Number.isFinite(value)) return '';
    return value.toLocaleString(locale, { useGrouping: false, maximumFractionDigits: 2 });
}
