<script lang="ts">
  import { getContext } from 'svelte';
  import ExpenseForm from '$lib/components/ExpenseForm.svelte';
  import { t } from '$lib/i18n';
  import type { ActiveKimpay } from '$lib/stores/activeKimpay.svelte';

  const ctx = getContext<{ value: ActiveKimpay }>('ACTIVE_KIMPAY');
  let activeKimpay = $derived(ctx.value);
  let kimpayId = $derived(activeKimpay?.id ?? '');
</script>

    <div class="container p-4 space-y-6">
        <header class="space-y-1">
            <h1 class="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 w-fit">{$t('expense.add.title')}</h1>
            <p class="text-slate-500 font-medium dark:text-slate-400 text-sm">{$t('expense.form.subtitle')}</p>
        </header>

        <div class="bg-card rounded-2xl shadow-sm border p-6 space-y-6 transition-colors animate-pop-in">
            <ExpenseForm {kimpayId} />
        </div>
    </div>
