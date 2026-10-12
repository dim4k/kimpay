<script lang="ts">
    import { ExternalLink } from '@lucide/svelte';
    import { t } from '#lib/i18n.js';
    import type { Participant } from '#lib/types.js';
    import { paymentLinks } from '#lib/utils/payment.js';
    import { buttonVariants } from '#lib/components/ui/button/index.js';

    interface Props {
        /** Who receives the money */
        to: Pick<Participant, 'name' | 'paypal' | 'revolut'> | undefined;
        amount: number;
        currency: string;
        class?: string;
        /** A link was opened (to ask, back in the app, whether it was paid) */
        onpay?: (service: string) => void;
    }

    let { to, amount, currency, class: className = '', onpay }: Props = $props();

    let links = $derived(paymentLinks(to, amount, currency));
</script>

{#if links.length > 0}
    <div class="flex flex-wrap items-center gap-2 {className}">
        {#each links as link (link.service)}
            <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onclick={() => onpay?.(link.label)}
                aria-label={$t('payment.pay_with', { service: link.label, name: to?.name ?? '' })}
                class={buttonVariants({ variant: 'soft', size: 'sm' })}
            >
                {$t('payment.pay_with_short', { service: link.label })}
                <ExternalLink />
            </a>
        {/each}
    </div>
{/if}
