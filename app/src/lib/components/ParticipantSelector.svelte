<script lang="ts">
    import type { Participant } from '$lib/types';
    import { t } from '$lib/i18n';

    interface Props {
        /** List of available participants */
        participants: Participant[];
        /** Currently selected participant IDs */
        selected: string[];
        /** Single selection mode (for payer) vs multi-select (for involved) */
        mode: 'single' | 'multi';
        /** Label for the section */
        label: string;
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

<div class="space-y-3">
    <div class="flex items-center justify-between">
        <span class="text-sm font-medium">
            {label}
            {#if mode === 'multi'}
                <span class="text-muted-foreground font-normal ml-1">({selectedCount})</span>
            {/if}
        </span>
        
        {#if showToggleAll && mode === 'multi'}
            <button onclick={toggleAll} class="text-sm text-primary font-medium hover:underline">
                {allSelected ? $t('expense.form.select_none') : $t('expense.form.select_all')}
            </button>
        {/if}
    </div>
    
    <div class="flex flex-wrap gap-2">
        {#each participants as p (p.id)}
            <button 
                onclick={() => handleSelect(p.id)}
                class="relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border {isSelected(p.id) ? 'bg-primary text-primary-foreground border-primary shadow-md' : 'bg-background text-muted-foreground border-input hover:bg-accent hover:text-accent-foreground'}"
            >
                {p.name}
            </button>
        {/each}
        
        {#if onAddNew}
            <button 
                onclick={onAddNew}
                class="px-4 py-2 rounded-full text-sm font-bold border border-dashed border-input text-muted-foreground hover:text-primary hover:border-primary hover:bg-accent transition-colors flex items-center gap-1"
                aria-label={$t('expense.form.paid_by_new')}
            >
                +
            </button>
        {/if}
    </div>
    
    {#if mode === 'multi' && selectedCount === 0}
        <p class="text-xs text-destructive font-medium">{$t('expense.form.error_select_one')}</p>
    {/if}
</div>
