<script lang="ts">
    import { untrack } from "svelte";
    import { Trash2, UserRound } from "@lucide/svelte";
    import { t } from '#lib/i18n.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { offlineStore } from '#lib/stores/offline.svelte.js';
    import { modals } from '#lib/stores/modals.svelte.js';
    import { toasts } from '#lib/stores/toasts.svelte.js';
    import { getErrorMessage } from '#lib/utils/errors.js';
    import { NAME_MAX_LENGTH } from '#lib/constants.js';
    import type { ActiveKimpay } from '#lib/stores/activeKimpay.svelte.js';
    import type { Participant } from '#lib/types.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import { Input } from '#lib/components/ui/input/index.js';
    import { Label } from '#lib/components/ui/label/index.js';
    import Avatar from '#lib/components/ui/Avatar.svelte';
    import Modal from '#lib/components/ui/modals/Modal.svelte';
    import ModalHeader from '#lib/components/ui/modals/ModalHeader.svelte';

    interface Props {
        /** The member shown (null: closed) */
        participant: Participant | null;
        activeKimpay: ActiveKimpay;
        /** They paid or share an expense: cannot be deleted */
        used: boolean;
        onClose: () => void;
        onDelete: (participant: Participant) => void;
        onOpenProfile: () => void;
    }

    let { participant, activeKimpay, used, onClose, onDelete, onOpenProfile }: Props = $props();

    let isMe = $derived(!!participant && participant.id === activeKimpay.myParticipantId);
    // Someone else's account: they manage their own name.
    let ownedByOther = $derived(!!participant?.user && participant.user !== auth.user?.id);

    // Typed over, reset to the name for each member opened (not when the
    // list is refreshed, which gives a new object for the same member).
    let participantId = $derived(participant?.id);
    let name = $derived.by(() => {
        void participantId;
        return untrack(() => participant?.name ?? '');
    });
    let isSaving = $state(false);

    async function rename() {
        const next = name.trim();
        if (!participant || !next || next === participant.name) return;
        isSaving = true;
        try {
            await activeKimpay.renameParticipant(participant.id, next);
            toasts.success($t('common.saved'));
            onClose();
        } catch (e) {
            console.error("Failed to rename participant", e);
            toasts.error(getErrorMessage(e, $t));
        } finally {
            isSaving = false;
        }
    }

    // Who the same person may also be: never two accounts.
    let others = $derived(
        participant
            ? activeKimpay.participants.filter((p) => p.id !== participant.id && !(participant.user && p.user && p.user !== participant.user))
            : []
    );

    function confirmMerge(into: Participant) {
        if (!participant) return;
        const from = participant;
        onClose();
        modals.confirm({
            title: $t('members.merge.confirm_title', { from: from.name, into: into.name }),
            description: $t('members.merge.confirm_desc', { from: from.name, into: into.name }),
            confirmText: $t('members.merge.confirm'),
            onConfirm: async () => {
                try {
                    await activeKimpay.mergeParticipant(from.id, into.id);
                    toasts.success($t('members.merge.done', { name: into.name }));
                } catch (e) {
                    console.error("Failed to merge participants", e);
                    toasts.error(getErrorMessage(e, $t));
                }
            },
        });
    }
</script>

<Modal isOpen={!!participant} {onClose} variant="sheet" label={participant?.name ?? ''}>
    {#if participant}
        <div class="flex items-center gap-3">
            <Avatar name={participant.name} record={participant} class="h-12 w-12 shrink-0 text-base" />
            <div class="min-w-0 flex-1">
                <ModalHeader title={participant.name} align="start" {onClose} />
            </div>
        </div>

        <div class="space-y-2">
            <Label for="member-name">{$t('members.name')}</Label>
            {#if ownedByOther}
                <p class="text-sm text-muted-foreground">{$t('members.name_from_account')}</p>
            {:else}
                <div class="flex gap-2">
                    <Input
                        id="member-name"
                        bind:value={name}
                        maxlength={NAME_MAX_LENGTH}
                        onkeydown={(e) => e.key === 'Enter' && rename()}
                    />
                    <Button onclick={rename} loading={isSaving} disabled={!name.trim() || name.trim() === participant.name}>
                        {$t('common.save')}
                    </Button>
                </div>
            {/if}
        </div>

        {#if others.length > 0 && !ownedByOther && !offlineStore.isOffline}
            <div class="space-y-2">
                <Label tag="span">{$t('members.merge.label')}</Label>
                <p class="text-sm text-muted-foreground">{$t('members.merge.desc', { name: participant.name })}</p>
                <div class="flex flex-wrap gap-2">
                    {#each others as other (other.id)}
                        <button
                            type="button"
                            onclick={() => confirmMerge(other)}
                            class="flex h-10 items-center gap-2 rounded-full border border-input bg-card pl-1 pr-3.5 text-sm font-medium transition-colors duration-150 hover:bg-muted"
                        >
                            <Avatar name={other.name} record={other} class="h-8 w-8 text-[0.6875rem]" />
                            {other.name}
                        </button>
                    {/each}
                </div>
            </div>
        {/if}

        <div class="flex flex-col gap-2">
            {#if isMe}
                <Button variant="secondary" class="w-full" onclick={() => { onClose(); onOpenProfile(); }}>
                    <UserRound />
                    {$t('settings.my_profile')}
                </Button>
            {:else if !used && !offlineStore.isOffline}
                <Button variant="ghost-destructive" class="w-full" onclick={() => { const p = participant!; onClose(); onDelete(p); }}>
                    <Trash2 />
                    {$t('modal.delete_participant.title')}
                </Button>
            {/if}
        </div>
    {/if}
</Modal>
