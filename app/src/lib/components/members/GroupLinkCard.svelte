<script lang="ts">
    import { Check, Copy, Link, QrCode, Share2 } from "@lucide/svelte";
    import { t } from '#lib/i18n.js';
    import { Button } from '#lib/components/ui/button/index.js';
    import IconTile from '#lib/components/ui/IconTile.svelte';
    import { toasts } from '#lib/stores/toasts.svelte.js';
    import { canShareNatively, copyLink, shareNatively } from '#lib/utils/share.js';

    /**
     * The group's link, in sight at the top of the members: copied or shared
     * in one tap. The QR code opens the invitation sheet. Each member not
     * here yet keeps their own link on their row.
     */
    interface Props {
        link: string;
        groupName: string;
        /** The invitation sheet (QR code for someone next to you) */
        onOpen: () => void;
    }

    let { link, groupName, onOpen }: Props = $props();

    const canShare = canShareNatively();
    let copied = $state(false);
    let shown = $derived(link.replace(/^https?:\/\//, ''));

    async function copy() {
        if (!(await copyLink(link))) {
            toasts.error($t('share.copy_error'));
            return;
        }
        toasts.success($t('share.copy_success'));
        copied = true;
        setTimeout(() => (copied = false), 2000);
    }
</script>

<section class="space-y-3 rounded-card border bg-card p-4 animate-pop-in" aria-labelledby="group-link-title" data-testid="group-link">
    <div class="flex items-center gap-3">
        <IconTile size="sm" tone="primary"><Link /></IconTile>
        <div class="min-w-0 flex-1">
            <h2 id="group-link-title" class="text-base font-semibold">{$t('members.group_link')}</h2>
            <p class="text-sm text-muted-foreground">{$t('members.group_link_desc')}</p>
        </div>
        <Button size="icon-sm" variant="secondary" onclick={onOpen} aria-label={$t('members.group_link_qr')} title={$t('members.group_link_qr')}>
            <QrCode />
        </Button>
    </div>
    <div class="flex items-center gap-2">
        <span class="min-w-0 flex-1 truncate rounded-control bg-muted px-3 py-2 font-mono text-sm text-muted-foreground">{shown}</span>
        <Button size="sm" variant={canShare ? 'soft' : 'default'} onclick={copy}>
            {#if copied}<Check />{:else}<Copy />{/if}
            {copied ? $t('share.copy_success') : $t('share.copy_short')}
        </Button>
        {#if canShare}
            <Button
                size="icon-sm"
                onclick={() => shareNatively({ title: $t('share.native_title', { name: groupName }), text: $t('share.native_text'), url: link })}
                aria-label={$t('share.invite_button')}
                title={$t('share.invite_button')}
            >
                <Share2 />
            </Button>
        {/if}
    </div>
</section>
