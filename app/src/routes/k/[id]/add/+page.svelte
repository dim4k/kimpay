<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { reopenExpenseSheet } from '#lib/expenseSheet.js';

  // The form is a sheet over the expense list: this address opens it there.
  // "?from=<id>": a new expense filled in from that one (duplicate).
  onMount(() => {
      const from = page.url.searchParams.get('from');
      reopenExpenseSheet(page.params.id ?? '', from ? { from } : {});
  });
</script>
