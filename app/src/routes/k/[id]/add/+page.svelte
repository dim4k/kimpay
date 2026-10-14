<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { reopenExpenseSheet } from '#lib/expenseSheet.js';

  // The form is a sheet over the expense list: this address opens it there.
  // "?from=<id>": a new expense filled in from that one (duplicate).
  // "?scan": from a receipt, the photo button first (app icon's shortcut).
  onMount(() => {
      const from = page.url.searchParams.get('from');
      const scan = page.url.searchParams.has('scan');
      reopenExpenseSheet(page.params.id ?? '', from ? { from } : scan ? { scan } : {});
  });
</script>
