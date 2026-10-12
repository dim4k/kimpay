<script lang="ts">
  import ExpenseForm from '#lib/components/ExpenseForm.svelte';
  import { t } from '#lib/i18n.js';
  import { getActiveKimpayContext } from '#lib/stores/activeKimpay.svelte.js';

  const ctx = getActiveKimpayContext();
  let activeKimpay = $derived(ctx.value);
  let kimpayId = $derived(activeKimpay?.id ?? '');
</script>

<ExpenseForm {kimpayId} title={$t('expense.add.title')} />
