<script lang="ts">
    import type { Component, Snippet } from 'svelte';
    import type { LucideProps } from '@lucide/svelte';
    import { X } from '@lucide/svelte';
    import { t } from '#lib/i18n.js';
    import { cn } from '#lib/utils/cn.js';

    type Tone = 'primary' | 'success' | 'destructive' | 'muted';

    /**
     * Heading of every dialog and sheet: optional icon, title, description,
     * and a close button when the dialog can be dismissed.
     */
    let {
        title,
        description,
        icon: Icon,
        tone = 'primary',
        align = 'center',
        onClose,
        actions,
    }: {
        title: string;
        description?: string | undefined;
        icon?: Component<LucideProps>;
        tone?: Tone;
        /** Centered for short dialogs, start for sheets holding a form */
        align?: 'center' | 'start';
        /** Shows the close button */
        onClose?: (() => void) | undefined;
        /** Icon buttons next to the close button (sheets: align start) */
        actions?: Snippet;
    } = $props();

    const tones: Record<Tone, string> = {
        primary: 'bg-primary-soft text-primary-soft-foreground',
        success: 'bg-success-soft text-success',
        destructive: 'bg-destructive/10 text-destructive',
        muted: 'bg-muted text-muted-foreground',
    };
</script>

<div class={cn('relative flex flex-col gap-3', align === 'center' ? 'items-center text-center' : actions ? 'items-start pr-20' : 'items-start pr-10')}>
    {#if actions}
        <div class="absolute -top-3 right-8 flex">
            {@render actions()}
        </div>
    {/if}
    {#if onClose}
        <button
            type="button"
            onclick={onClose}
            class="absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={$t('common.close')}
            title={$t('common.close')}
        >
            <X class="h-5 w-5" />
        </button>
    {/if}
    {#if Icon}
        <span class={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full', tones[tone])} aria-hidden="true">
            <Icon class="h-6 w-6" />
        </span>
    {/if}
    <!-- A long word (an e-mail address) wraps rather than overflows. -->
    <div class="min-w-0 max-w-full space-y-1 wrap-anywhere">
        <h2 class="text-xl font-bold text-balance">{title}</h2>
        {#if description}
            <p class="whitespace-pre-line text-sm text-muted-foreground">{description}</p>
        {/if}
    </div>
</div>
