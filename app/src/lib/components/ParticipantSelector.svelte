<script lang="ts">
    import type { Participant } from '#lib/types.js';
    import { t } from '#lib/i18n.js';
    import { UserPlus } from '@lucide/svelte';
    import { slide } from 'svelte/transition';
    import Avatar from '#lib/components/ui/Avatar.svelte';
    import { haptic } from '#lib/utils/haptic.js';
    import { NAME_MAX_LENGTH } from '#lib/constants.js';
    import { Label } from '#lib/components/ui/label/index.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Input } from '#lib/components/ui/input/index.js';

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
        /** Adds a member by name (the field under the list, as on the Members tab) */
        onAdd?: (name: string) => Promise<void>;
        /** Shortcuts over the list (multi mode): everyone, or only me once everyone is ticked */
        showToggleAll?: boolean;
        /** Who I am in the group, for "Only me" */
        meId?: string | null;
        /** The label is read out only (the panel holding it says it already) */
        hideLabel?: boolean;
    }

    let { 
        participants,
        selected = $bindable([]),
        mode,
        label,
        hint = '',
        onSelectionChange,
        onAdd,
        showToggleAll = false,
        meId = null,
        hideLabel = false
    }: Props = $props();

    function handleSelect(participantId: string) {
        if (mode === 'single') {
            selected = [participantId];
        } else {
            if (selected.includes(participantId)) {
                // The last one stays: said, rather than nothing happening.
                if (selected.length === 1) {
                    refuse();
                    return;
                }
                selected = selected.filter(id => id !== participantId);
            } else {
                selected = [...selected, participantId];
            }
        }
        onSelectionChange(selected);
    }

    // "At least one person", for a moment, after trying to untick the last one.
    let refused = $state(false);
    let refusedTimer: ReturnType<typeof setTimeout> | undefined;

    function refuse() {
        haptic('error');
        refused = true;
        clearTimeout(refusedTimer);
        refusedTimer = setTimeout(() => (refused = false), 2500);
    }

    // Never nobody (unticking the last one is refused too): everyone, or,
    // once everyone is ticked, only me.
    function selectAll() {
        selected = participants.map(p => p.id);
        onSelectionChange(selected);
    }

    function selectOnlyMe() {
        if (!meId) return;
        selected = [meId];
        onSelectionChange(selected);
    }

    const canSelectOnlyMe = $derived(!!meId && participants.length > 1 && participants.some(p => p.id === meId));

    function isSelected(participantId: string): boolean {
        return selected.includes(participantId);
    }

    // The field is free for the next name at once; the name comes back on failure.
    let newName = $state('');
    async function add() {
        const name = newName.trim();
        if (!name || !onAdd) return;
        newName = '';
        try {
            await onAdd(name);
        } catch {
            if (!newName) newName = name;
        }
    }

    const selectedCount = $derived(selected.length);
    const allSelected = $derived(selected.length === participants.length);
</script>

<div class="space-y-2" role="group" aria-label={label}>
    <div class="flex min-h-6 items-center justify-between" class:sr-only={hideLabel}>
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
            {#if !allSelected}
                <button type="button" onclick={selectAll} class="text-sm font-semibold text-primary hover:underline">
                    {$t('expense.form.select_all')}
                </button>
            {:else if canSelectOnlyMe}
                <button type="button" onclick={selectOnlyMe} class="text-sm font-semibold text-primary hover:underline">
                    {$t('expense.form.only_me')}
                </button>
            {/if}
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
    </div>

    {#if onAdd}
        <!-- Not a search: a new member of the group, added at once. -->
        <p class="pt-3 text-sm font-medium text-muted-foreground">{$t('expense.form.add_member')}</p>
        <div class="flex gap-2">
            <Input
                bind:value={newName}
                maxlength={NAME_MAX_LENGTH}
                placeholder={$t('settings.participants.placeholder')}
                aria-label={$t('settings.participants.placeholder')}
                onkeydown={(e) => e.key === 'Enter' && add()}
            />
            <Button size="icon" class="shrink-0" onclick={add} disabled={!newName.trim()} aria-label={$t('settings.participants.add')}>
                <UserPlus />
            </Button>
        </div>
    {/if}

    <div aria-live="polite">
        {#if mode === 'multi' && (selectedCount === 0 || refused)}
            <p class="text-sm font-medium text-destructive" transition:slide={{ duration: 150 }}>{$t('expense.form.error_select_one')}</p>
        {/if}
    </div>
</div>
