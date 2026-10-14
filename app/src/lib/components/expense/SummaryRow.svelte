<script lang="ts">
    import type { Component, Snippet } from 'svelte';
    import type { LucideProps } from '@lucide/svelte';
    import { ChevronRight } from '@lucide/svelte';
    import IconTile from '#lib/components/ui/IconTile.svelte';

    /**
     * A row of the expense form's summary (a ListGroup): what is set, under
     * its name. Opens the panel where it is changed.
     */
    let {
        label,
        icon: Icon,
        lead,
        invalid = false,
        onclick,
        children,
    }: {
        label: string;
        icon?: Component<LucideProps>;
        /** Custom leading content (avatars), instead of `icon` */
        lead?: Snippet;
        /** What is set needs fixing (shown in red) */
        invalid?: boolean;
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
        <span class="text-sm text-muted-foreground">{label}</span>
        <span class="flex min-w-0 items-center gap-2 text-base font-medium {invalid ? 'text-destructive' : ''}">
            {@render children()}
        </span>
    </span>
    <ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground" />
</button>
