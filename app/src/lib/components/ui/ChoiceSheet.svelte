<script lang="ts">
    import { Check, Search } from '@lucide/svelte';
    import { Input } from '#lib/components/ui/input/index.js';
    import ListGroup from '#lib/components/ui/ListGroup.svelte';
    import Modal from '#lib/components/ui/modals/Modal.svelte';
    import ModalHeader from '#lib/components/ui/modals/ModalHeader.svelte';

    export interface Choice {
        value: string;
        label: string;
        /** Under the label (a currency's name) */
        detail?: string;
        /** Before the label (a symbol), in a tile */
        lead?: string;
        /** Its language, read out right (the languages' own names) */
        lang?: string;
    }

    /**
     * One choice in a list too long for a segmented control (currency,
     * language): a sheet of its own, over whatever opened it, with a search
     * when the list is long.
     */
    let {
        isOpen,
        title,
        choices,
        value,
        onselect,
        onClose,
        searchPlaceholder,
        noResult,
    }: {
        isOpen: boolean;
        title: string;
        choices: Choice[];
        value: string;
        onselect: (value: string) => void;
        onClose: () => void;
        /** Shows a search field */
        searchPlaceholder?: string;
        /** "No currency for “{query}”" */
        noResult?: (query: string) => string;
    } = $props();

    let query = $state('');
    $effect(() => {
        if (isOpen) query = '';
    });

    function normalize(text: string): string {
        return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    }

    let shown = $derived.by(() => {
        const q = normalize(query.trim());
        if (!q) return choices;
        return choices.filter((c) => normalize(`${c.value} ${c.label} ${c.detail ?? ''} ${c.lead ?? ''}`).includes(q));
    });

    function choose(next: string) {
        onselect(next);
        onClose();
    }

    // Typing right away on a computer; on a phone, the keyboard would cover the list.
    function focusOnDesktop(node: HTMLInputElement) {
        if (window.matchMedia('(pointer: fine)').matches) node.focus();
    }
</script>

<Modal {isOpen} {onClose} variant="sheet" label={title} class="space-y-4">
    <ModalHeader {title} align="start" {onClose} />

    {#if searchPlaceholder}
        <div class="relative">
            <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                type="search"
                bind:value={query}
                {@attach focusOnDesktop}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                autocomplete="off"
                class="pl-9"
            />
        </div>
    {/if}

    {#if shown.length === 0}
        <p class="py-8 text-center text-sm text-muted-foreground">{noResult?.(query.trim()) ?? ''}</p>
    {:else}
        <ListGroup>
            <div role="radiogroup" aria-label={title} class="divide-y divide-border">
                {#each shown as choice (choice.value)}
                    <button
                        type="button"
                        role="radio"
                        aria-checked={choice.value === value}
                        lang={choice.lang}
                        onclick={() => choose(choice.value)}
                        class="flex w-full min-h-14 items-center gap-3 px-4 py-2 text-left transition-colors duration-150 first:rounded-t-[inherit] last:rounded-b-[inherit] hover:bg-muted/60 focus-ring-inset"
                    >
                        {#if choice.lead}
                            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-muted text-base font-semibold" aria-hidden="true">{choice.lead}</span>
                        {/if}
                        <span class="flex min-w-0 flex-1 flex-col">
                            <span class="truncate text-base font-medium">{choice.label}</span>
                            {#if choice.detail}
                                <span class="truncate text-sm text-muted-foreground">{choice.detail}</span>
                            {/if}
                        </span>
                        {#if choice.value === value}
                            <Check class="h-5 w-5 shrink-0 text-primary" />
                        {/if}
                    </button>
                {/each}
            </div>
        </ListGroup>
    {/if}
</Modal>
