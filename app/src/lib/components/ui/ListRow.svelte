<script lang="ts">
    import type { Component, Snippet } from 'svelte';
    import type { LucideProps } from '@lucide/svelte';
    import { ChevronRight, ArrowUpRight } from '@lucide/svelte';
    import { cn } from '#lib/utils/cn.js';
    import IconTile from './IconTile.svelte';

    interface Props {
        title: string;
        subtitle?: string;
        /** Current value, shown on the right (e.g. "PayPal", "EUR") */
        value?: string;
        icon?: Component<LucideProps>;
        /** Custom leading content (avatar, emoji...), instead of `icon` */
        lead?: Snippet;
        /** Custom trailing content, instead of `value` and the chevron */
        trailing?: Snippet;
        href?: string;
        /** Opens in a new tab, with an outgoing arrow instead of the chevron */
        external?: boolean;
        onclick?: () => void;
        disabled?: boolean;
        tone?: 'default' | 'danger';
        class?: string;
    }

    let {
        title,
        subtitle,
        value,
        icon: Icon,
        lead,
        trailing,
        href,
        external = false,
        onclick,
        disabled = false,
        tone = 'default',
        class: className = ''
    }: Props = $props();

    let interactive = $derived(!!href || !!onclick);
    let classes = $derived(cn(
        'flex w-full min-h-14 items-center gap-3 px-4 py-3 text-left first:rounded-t-[inherit] last:rounded-b-[inherit]',
        interactive && 'transition-colors duration-150 hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50',
        className
    ));
</script>

{#snippet content()}
    {#if lead}
        {@render lead()}
    {:else if Icon}
        <IconTile size="sm" tone={tone === 'danger' ? 'danger' : 'muted'}><Icon /></IconTile>
    {/if}
    <span class="flex min-w-0 flex-1 flex-col">
        <span class="truncate text-base font-medium {tone === 'danger' ? 'text-destructive' : 'text-foreground'}">{title}</span>
        {#if subtitle}
            <span class="truncate text-sm text-muted-foreground">{subtitle}</span>
        {/if}
    </span>
    {#if trailing}
        {@render trailing()}
    {:else}
        {#if value}
            <span class="max-w-[40%] shrink-0 truncate text-sm text-muted-foreground">{value}</span>
        {/if}
        {#if external}
            <ArrowUpRight class="h-4 w-4 shrink-0 text-muted-foreground" />
        {:else if interactive}
            <ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground" />
        {/if}
    {/if}
{/snippet}

{#if href}
    <a {href} class={classes} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
        {@render content()}
    </a>
{:else if onclick}
    <button type="button" {onclick} {disabled} class={classes}>
        {@render content()}
    </button>
{:else}
    <div class={classes}>
        {@render content()}
    </div>
{/if}
