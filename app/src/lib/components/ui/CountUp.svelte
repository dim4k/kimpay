<script lang="ts">
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  let { value, duration = 800, decimals = 2 } = $props();

  const displayedValue = new Tween(0, {
      easing: cubicOut
  });

  $effect(() => {
      displayedValue.set(value, { duration });
  });
</script>

<span>{displayedValue.current.toFixed(decimals)}</span>
