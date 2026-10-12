<script lang="ts">
    import type { Participant } from '#lib/types.js';
    import { t } from '#lib/i18n.js';
    import { Plus } from '@lucide/svelte';
    import Avatar from '#lib/components/ui/Avatar.svelte';
    import { Label } from '#lib/components/ui/label/index.js';

    interface Props {
        /** List of available participants */
        participants: Participant[];
        /** Currently selected participant IDs */
        selected: string[];
        /** Single selection mode (for payer) vs multi-select (for involved) */
        mode: 'single' | 'multi';
        /** Label for the section */
        label: string;
        /** Shown after the label (e.g. what each one pays) */
        hint?: string;
        /** Callback when selection changes */
        onSelectionChange: (selected: string[]) => void;
        /** Callback to add a new participant */
        onAddNew?: () => void;
        /** Show select all/none toggle (only for multi mode) */
        showToggleAll?: boolean;
    }

    let { 
        participants,
        selected = $bindable([]),
        mode,
        label,
        hint = '',
        onSelectionChange,
        onAddNew,
        showToggleAll = false
    }: Props = $props();

    function handleSelect(participantId: string) {
        if (mode === 'single') {
            selected = [participantId];
        } else {
            if (selected.includes(participantId)) {
                // Don't allow deselecting last item
                if (selected.length > 1) {
                    selected = selected.filter(id => id !== participantId);
                }
            } else {
                selected = [...selected, participantId];
            }
        }
        onSelectionChange(selected);
    }

    function toggleAll() {
        if (selected.length === participants.length) {
            selected = [];
        } else {
            selected = participants.map(p => p.id);
        }
        onSelectionChange(selected);
    }

    function isSelected(participantId: string): boolean {
        return selected.includes(participantId);
    }

    const selectedCount = $derived(selected.length);
    const allSelected = $derived(selected.length === participants.length);
</script>

<div class="space-y-2" role="group" aria-label={label}>
    <div class="flex min-h-6 items-center justify-between">
        <Label tag="span">
            {label}
            {#if mode === 'multi'}
                <span class="font-normal">({selectedCount})</span>
            {/if}
            {#if hint}
                <span class="font-normal">·</span> <span class="text-foreground">{hint}</span>
            {/if}
        </Label>

        {#if showToggleAll && mode === 'multi'}
            <button type="button" onclick={toggleAll} class="text-sm font-semibold text-primary hover:underline">
                {allSelected ? $t('expense.form.select_none') : $t('expense.form.select_all')}
            </button>
        {/if}
    </div>

    <div class="flex flex-wrap gap-2">
        {#each participants as p (p.id)}
            <button
                type="button"
                onclick={() => handleSelect(p.id)}
                aria-pressed={isSelected(p.id)}
                class="flex h-10 items-center gap-2 rounded-full border pl-1 pr-3.5 text-sm font-medium transition-colors duration-150 {isSelected(p.id) ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-input bg-card text-foreground hover:bg-muted'}"
            >
                <Avatar name={p.name} record={p} class="h-8 w-8 text-[0.6875rem]" />
                {p.name}
            </button>
        {/each}

        {#if onAddNew}
            <button
                type="button"
                onclick={onAddNew}
                class="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-input text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                aria-label={$t('expense.form.paid_by_new')}
                title={$t('expense.form.paid_by_new')}
            >
                <Plus class="h-4 w-4" />
            </button>
        {/if}
    </div>

    {#if mode === 'multi' && selectedCount === 0}
        <p class="text-sm font-medium text-destructive">{$t('expense.form.error_select_one')}</p>
    {/if}
</div>
