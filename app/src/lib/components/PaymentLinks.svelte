<script lang="ts">
    import { ExternalLink } from '@lucide/svelte';
    import { t } from '#lib/i18n.js';
    import type { Participant } from '#lib/types.js';
    import { paymentLinks } from '#lib/utils/payment.js';

    interface Props {
        /** Who receives the money */
        to: Pick<Participant, 'name' | 'paypal' | 'revolut'> | undefined;
        amount: number;
        currency: string;
        class?: string;
    }

    let { to, amount, currency, class: className = '' }: Props = $props();

    let links = $derived(paymentLinks(to, amount, currency));
</script>

{#if links.length > 0}
    <div class="flex flex-wrap items-center gap-2 {className}">
        {#each links as link (link.service)}
            <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={$t('payment.pay_with', { service: link.label, name: to?.name ?? '' })}
                class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors {link.service === 'paypal'
                    ? 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'}"
            >
                {$t('payment.pay_with_short', { service: link.label })}
                <ExternalLink class="h-3 w-3" />
            </a>
        {/each}
    </div>
{/if}
