<script lang="ts">
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { locale } from '#lib/i18n.js';
  import { formatAmount } from '#lib/services/currency.js';

  /** With `currency`, the value is formatted as an amount (symbol included). */
  let { value, currency, duration = 600, decimals = 2 }: { value: number; currency?: string; duration?: number; decimals?: number } = $props();

  const displayedValue = new Tween(0, {
      easing: cubicOut
  });

  const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Locale-aware formatting (e.g. "44,55" in fr, "44.55" in en)
  let formatter = $derived(new Intl.NumberFormat($locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
  }));

  $effect(() => {
      displayedValue.set(value, { duration: reducedMotion ? 0 : duration });
  });
</script>

<span>{currency ? formatAmount(displayedValue.current, currency, $locale) : formatter.format(displayedValue.current)}</span>
