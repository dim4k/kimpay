<script lang="ts">
  import { t } from '#lib/i18n.js';
  import { page } from '$app/state';
  import { offlineStore } from '#lib/stores/offline.svelte.js';
  import { storageService } from '#lib/services/storage.js';
  import { House, WifiOff } from "@lucide/svelte";
  import { Button } from '#lib/components/ui/button/index.js';

  const isOffline = $derived(offlineStore.isOffline);
  let hasRecentKimpays = $state(false);
  
  $effect(() => {
      storageService.getRecentKimpayIds().then(ids => {
          hasRecentKimpays = ids.length > 0;
      });
  });

  const errorStatus = $derived(page.status);
</script>

<div class="flex min-h-dvh flex-col items-center justify-center bg-background p-4 text-center">
    <div class="mx-auto max-w-md space-y-6 animate-pop-in">
        {#if isOffline}
            <div class="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                <WifiOff class="h-10 w-10 text-muted-foreground" />
            </div>
            <div class="space-y-2">
                <h1 class="text-2xl font-bold">{$t('error.offline.title')}</h1>
                <p class="text-muted-foreground">{$t('error.offline.desc')}</p>
            </div>
            <Button href="/" size="lg">
                <House />
                {hasRecentKimpays ? $t('error.offline.view_cached') : $t('error.404.button')}
            </Button>
        {:else}
            <p class="text-7xl font-extrabold tracking-tight text-gradient-brand">{errorStatus}</p>
            <div class="space-y-2">
                <h1 class="text-2xl font-bold">{$t('error.404.title')}</h1>
                <p class="text-muted-foreground">{$t('error.404.desc')}</p>
            </div>
            <Button href="/" size="lg">
                <House />
                {$t('error.404.button')}
            </Button>
        {/if}
    </div>
</div>
