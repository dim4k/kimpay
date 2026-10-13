<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { reopenExpenseSheet } from '#lib/expenseSheet.js';

  // The form is a sheet over the expense list: this address opens it there.
  onMount(() => {
      const { id = '', expenseId = '' } = page.params as Record<string, string>;
      reopenExpenseSheet(id, { expenseId });
  });
</script>
