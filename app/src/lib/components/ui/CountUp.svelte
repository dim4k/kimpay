<script lang="ts">
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { locale } from '#lib/i18n.js';

  let { value, duration = 800, decimals = 2 }: { value: number; duration?: number; decimals?: number } = $props();

  const displayedValue = new Tween(0, {
      easing: cubicOut
  });

  // Locale-aware formatting (e.g. "44,55" in fr, "44.55" in en)
  let formatter = $derived(new Intl.NumberFormat($locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
  }));

  $effect(() => {
      displayedValue.set(value, { duration });
  });
</script>

<span>{formatter.format(displayedValue.current)}</span>
