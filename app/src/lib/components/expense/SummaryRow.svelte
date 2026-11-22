<script lang="ts">
    import type { Component, Snippet } from 'svelte';
    import type { LucideProps } from '@lucide/svelte';
    import { ChevronRight } from '@lucide/svelte';
    import IconTile from '#lib/components/ui/IconTile.svelte';
    import { t } from '#lib/i18n.js';

    /**
     * A row of the expense form's summary (a ListGroup): what is set, under
     * its name. Opens the panel where it is changed.
     */
    let {
        label,
        icon: Icon,
        lead,
        invalid = false,
        changed = false,
        onclick,
        children,
    }: {
        label: string;
        icon?: Component<LucideProps>;
        /** Custom leading content (avatars), instead of `icon` */
        lead?: Snippet;
        /** What is set needs fixing (shown in red) */
        invalid?: boolean;
        /** An expense edited: this setting is not what was saved */
        changed?: boolean | undefined;
        onclick: () => void;
        /** What is set */
        children: Snippet;
    } = $props();
</script>

<button
    type="button"
    {onclick}
    class="flex w-full min-h-14 items-center gap-3 px-4 py-3 text-left transition-colors duration-150 first:rounded-t-[inherit] last:rounded-b-[inherit] hover:bg-muted/60 focus-ring-inset"
>
    {#if lead}
        {@render lead()}
    {:else if Icon}
        <IconTile size="sm" tone={invalid ? 'danger' : 'muted'}><Icon /></IconTile>
    {/if}
    <span class="flex min-w-0 flex-1 flex-col">
        <span class="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <span class="truncate">{label}</span>
            {#if changed}
                <span class="flex shrink-0 items-center gap-1 font-medium text-primary" data-testid="changed">
                    <span class="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true"></span>
                    {$t('expense.form.changed')}
                </span>
            {/if}
        </span>
        <span class="flex min-w-0 items-center gap-2 text-base font-medium {invalid ? 'text-destructive' : ''}">
            {@render children()}
        </span>
    </span>
    <ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground" />
</button>
