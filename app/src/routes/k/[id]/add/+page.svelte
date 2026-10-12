<script lang="ts">
  import ExpenseForm from '#lib/components/ExpenseForm.svelte';
  import { t } from '#lib/i18n.js';
  import { page } from '$app/state';
  import { getActiveKimpayContext } from '#lib/stores/activeKimpay.svelte.js';

  const ctx = getActiveKimpayContext();
  let activeKimpay = $derived(ctx.value);
  let kimpayId = $derived(activeKimpay?.id ?? '');

  // "Duplicate" on an expense: a new one, filled in from it (?from=<id>).
  const fromId = page.url.searchParams.get('from');
  let template = $derived(
      fromId ? activeKimpay?.expenses.find((e) => e.id === fromId && !e.is_reimbursement) ?? null : null
  );
</script>

<ExpenseForm {kimpayId} {template} title={$t('expense.add.title')} />
