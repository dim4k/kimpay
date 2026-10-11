import type { Participant } from '#lib/types.js';

export type PaymentService = 'paypal' | 'revolut';

export interface PaymentLink {
    service: PaymentService;
    label: string;
    url: string;
}

const HANDLE = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Normalize what someone typed as a payment handle: a pasted link
 * ("https://paypal.me/alice/10", "revolut.me/bob") or "@alice" gives the bare
 * handle. Returns "" for an empty input, null when it is not a valid handle.
 */
export function normalizeHandle(input: string): string | null {
    let value = input.trim();
    if (!value) return '';
    value = value
        .replace(/^https?:\/\//i, '')
        .replace(/^(www\.)?(paypal\.me|revolut\.me)\//i, '')
        .replace(/^@/, '')
        .split(/[/?#]/)[0]!;
    return HANDLE.test(value) ? value : null;
}

/**
 * Links to pay `participant`, for the services they set up. PayPal.me links
 * carry the amount; Revolut.me links open the person's payment page.
 */
export function paymentLinks(participant: Pick<Participant, 'paypal' | 'revolut'> | undefined, amount: number, currency: string): PaymentLink[] {
    const links: PaymentLink[] = [];
    if (!participant) return links;
    if (participant.paypal && HANDLE.test(participant.paypal)) {
        links.push({
            service: 'paypal',
            label: 'PayPal',
            url: `https://paypal.me/${encodeURIComponent(participant.paypal)}/${amount.toFixed(2)}${currency.toUpperCase()}`,
        });
    }
    if (participant.revolut && HANDLE.test(participant.revolut)) {
        links.push({
            service: 'revolut',
            label: 'Revolut',
            url: `https://revolut.me/${encodeURIComponent(participant.revolut)}`,
        });
    }
    return links;
}
