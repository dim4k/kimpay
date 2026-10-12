<script lang="ts">
  import { onMount } from 'svelte';

  import { Copy, Check, Share2, LoaderCircle, Link, Trash2 } from "@lucide/svelte";
  import { t } from '#lib/i18n.js';
  import QRCode from 'qrcode';
  import { getActiveKimpayContext } from '#lib/stores/activeKimpay.svelte.js';
  import { offlineStore } from '#lib/stores/offline.svelte.js';
  import { modals } from '#lib/stores/modals.svelte.js';
  import { toasts } from '#lib/stores/toasts.svelte.js';
  import { haptic } from '#lib/utils/haptic.js';
  import { getErrorMessage } from '#lib/utils/errors.js';
  import { generateUUID } from '#lib/utils/id.js';
  import { Button } from '#lib/components/ui/button/index.js';
  import Avatar from '#lib/components/ui/Avatar.svelte';
  import SectionLabel from '#lib/components/ui/SectionLabel.svelte';

  // Get ActiveKimpay from context
  const ctx = getActiveKimpayContext();
  let activeKimpay = $derived(ctx.value);

  let kimpay = $derived(activeKimpay?.kimpay);
  let participants = $derived(activeKimpay?.participants || []);
  let inviteLink = $state("");
  let copied = $state(false);
  let qrDataUrl = $state<string | null>(null);

  onMount(async () => {
      inviteLink = window.location.href.replace('/share', ''); // Clean URL

      // Dark modules on white: drawn on a white tile in both themes, which
      // is what phone cameras read best.
      try {
           qrDataUrl = await QRCode.toDataURL(inviteLink, {
               width: 300,
               margin: 1,
               color: { dark: '#1e293b', light: '#ffffff' }
           });
      } catch (err) {
          console.error("QR Generation failed", err);
      }
  });

  async function copyText(text: string): Promise<boolean> {
      try {
          await navigator.clipboard.writeText(text);
          haptic('light');
          toasts.success($t('share.copy_success'));
          return true;
      } catch (err) {
          console.error('Failed to copy', err);
          toasts.error($t('share.copy_error'));
          return false;
      }
  }

  async function copyLink() {
      if (await copyText(inviteLink)) {
          copied = true;
          setTimeout(() => copied = false, 2000);
      }
  }

  async function shareNative() {
      if (navigator.share) {
          try {
              await navigator.share({
                  title: $t('share.native_title', { name: kimpay?.name || 'Kimpay' }),
                  text: $t('share.native_text'),
                  url: inviteLink
              });
          } catch (err) {
              console.log('Share canceled', err);
          }
      } else {
          copyLink();
      }
  }

  // Read-only summary link
  let readonlyLink = $derived(kimpay?.readonly_token ? `${window.location.origin}/r/${kimpay.readonly_token}` : "");
  let isUpdatingLink = $state(false);

  async function setReadonlyLink(enabled: boolean) {
      isUpdatingLink = true;
      try {
          await activeKimpay.setReadonlyToken(enabled ? generateUUID() : "");
      } catch (e) {
          console.error("Failed to update the read-only link", e);
          modals.alert({ message: getErrorMessage(e, $t) });
      } finally {
          isUpdatingLink = false;
      }
  }

  function requestDisableReadonlyLink() {
      modals.confirm({
          title: $t('settings.readonly.disable_title'),
          description: $t('settings.readonly.disable_desc'),
          confirmText: $t('settings.readonly.disable'),
          variant: 'destructive',
          onConfirm: () => setReadonlyLink(false)
      });
  }

  async function shareReadonlyLink() {
      if (!navigator.share) return copyText(readonlyLink);
      try {
          await navigator.share({ title: kimpay?.name ?? 'Kimpay', url: readonlyLink });
      } catch {
          // Share sheet dismissed.
      }
  }
</script>

<div class="mx-auto w-full max-w-2xl space-y-6 px-4 py-4">
    <h1 class="sr-only">{$t('nav.share')}</h1>

    <!-- Most used first: send the link -->
    <section class="space-y-4 rounded-card border bg-card p-4 animate-pop-in">
        <div class="flex items-start justify-between gap-3">
            <div class="space-y-1">
                <h2 class="text-xl font-bold">{$t('share.invite_title')}</h2>
                <p class="text-sm text-muted-foreground">{$t('share.invite_friends')}</p>
            </div>
            <span class="flex shrink-0 pt-1" aria-hidden="true">
                {#each participants.slice(0, 4) as p, i (p.id)}
                    <Avatar name={p.name} record={p} class="h-8 w-8 text-xs ring-2 ring-card {i > 0 ? '-ml-2' : ''}" />
                {/each}
            </span>
        </div>

        <Button size="lg" class="w-full" onclick={shareNative}>
            <Share2 class="size-5!" />
            {$t('share.invite_button')}
        </Button>

        <div class="flex items-center gap-2 rounded-control bg-muted py-1 pl-3 pr-1">
            <Link class="h-4 w-4 shrink-0 text-muted-foreground" />
            <span class="min-w-0 flex-1 truncate font-mono text-sm text-muted-foreground">{inviteLink}</span>
            <Button size="sm" variant="soft" onclick={copyLink}>
                {#if copied}
                    <Check />
                    {$t('share.copy_success')}
                {:else}
                    <Copy />
                    {$t('share.copy_button')}
                {/if}
            </Button>
        </div>
    </section>

    <section class="space-y-2 animate-slide-up">
        <SectionLabel title={$t('share.qr_title')} />
        <div class="flex flex-col items-center gap-3 rounded-card border bg-card p-5">
            <div class="rounded-control bg-white p-2">
                {#if qrDataUrl}
                    <img src={qrDataUrl} alt={$t('share.qr_alt')} class="h-44 w-44" />
                {:else}
                    <div class="flex h-44 w-44 items-center justify-center text-muted-foreground">
                        <LoaderCircle class="h-8 w-8 animate-spin" />
                    </div>
                {/if}
            </div>
            <p class="text-center text-sm text-muted-foreground">{$t('share.qr_desc')}</p>
        </div>
    </section>

    {#if !offlineStore.isOffline}
        <section class="space-y-2 animate-slide-up">
            <SectionLabel title={$t('settings.readonly.title')} />
            <div class="space-y-3 rounded-card border bg-card p-4">
                <p class="text-sm text-muted-foreground">{$t('settings.readonly.desc')}</p>
                {#if readonlyLink}
                    <div class="flex items-center gap-2 rounded-control bg-muted px-3 py-2.5">
                        <Link class="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span class="min-w-0 flex-1 truncate font-mono text-sm text-muted-foreground">{readonlyLink}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <Button variant="outline" onclick={() => copyText(readonlyLink)}>
                            <Copy />
                            {$t('share.copy_button')}
                        </Button>
                        <Button variant="outline" onclick={shareReadonlyLink}>
                            <Share2 />
                            {$t('nav.share')}
                        </Button>
                    </div>
                    <Button variant="ghost-destructive" class="w-full" onclick={requestDisableReadonlyLink} disabled={isUpdatingLink}>
                        <Trash2 />
                        {$t('settings.readonly.disable')}
                    </Button>
                {:else}
                    <Button variant="outline" class="w-full" onclick={() => setReadonlyLink(true)} disabled={isUpdatingLink}>
                        {#if isUpdatingLink}
                            <LoaderCircle class="animate-spin" />
                        {:else}
                            <Link />
                        {/if}
                        {$t('settings.readonly.create')}
                    </Button>
                {/if}
            </div>
        </section>
    {/if}
</div>
