<script lang="ts">
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  let { value, duration = 800, decimals = 2 } = $props();

  const displayedValue = tweened(0, {
      duration: duration,
      easing: cubicOut
  });

  $effect(() => {
      displayedValue.set(value);
  });
</script>

<span>{$displayedValue.toFixed(decimals)}</span>
