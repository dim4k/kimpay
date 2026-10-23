<script lang="ts">
  import { ChevronLeft } from "@lucide/svelte";
  import { t } from '#lib/i18n.js';
  import { getActiveKimpayContext } from '#lib/stores/activeKimpay.svelte.js';
  import ActivityFeed from '#lib/components/activity/ActivityFeed.svelte';

  const ctx = getActiveKimpayContext();
  let kimpayId = $derived(ctx.value?.id ?? '');
</script>

<div class="mx-auto w-full max-w-2xl space-y-5 px-4 py-4">
    <div class="flex items-center gap-1">
        <a
            href="/k/{kimpayId}/settings"
            class="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={$t('nav.settings')}
            title={$t('nav.settings')}
        >
            <ChevronLeft class="h-5 w-5" />
        </a>
        <h1 class="text-xl font-bold">{$t('activity.title')}</h1>
    </div>

    <ActivityFeed />
</div>
