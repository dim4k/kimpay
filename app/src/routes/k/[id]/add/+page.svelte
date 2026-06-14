<script lang="ts">
  import { getContext } from 'svelte';
  import ExpenseForm from '$lib/components/ExpenseForm.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { t } from '$lib/i18n';
  import type { ActiveKimpay } from '$lib/stores/activeKimpay.svelte';

  const ctx = getContext<{ value: ActiveKimpay }>('ACTIVE_KIMPAY');
  let activeKimpay = $derived(ctx.value);
  let kimpayId = $derived(activeKimpay?.id ?? '');
</script>

    <div class="container p-4 space-y-6">
        <PageHeader title={$t('expense.add.title')} subtitle={$t('expense.form.subtitle')} />

        <div class="bg-card rounded-2xl shadow-sm border p-6 space-y-6 transition-colors animate-pop-in">
            <ExpenseForm {kimpayId} />
        </div>
    </div>
