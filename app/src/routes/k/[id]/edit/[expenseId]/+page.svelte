<script lang="ts">
  import { page } from '$app/stores';
  import ExpenseForm from '$lib/components/ExpenseForm.svelte';
  import { pb } from '$lib/pocketbase';
  import { onMount } from 'svelte';
  import { Loader2 } from "lucide-svelte";

import { t } from '$lib/i18n';

  let kimpayId = $derived($page.params.id);
  let expenseId = $derived($page.params.expenseId);
  
  let initialData: any = $state(null);
  let isLoading = $state(true);
  let error = $state("");

  onMount(async () => {
    try {
        initialData = await pb.collection('expenses').getOne(expenseId);
    } catch (e) {
        console.error(e);
        error = "Failed to load expense.";
    } finally {
        isLoading = false;
    }
  });
</script>

<div class="min-h-screen bg-slate-50 dark:bg-background transition-colors pb-24">
    <main class="container p-4 space-y-6">
        <header class="space-y-1">
            <h1 class="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 w-fit">{$t('expense.edit.title')}</h1>
            <p class="text-slate-500 font-medium dark:text-slate-400 text-sm">{$t('expense.form.subtitle')}</p>
        </header>

        <div class="bg-card rounded-2xl shadow-sm border p-6 space-y-6 transition-colors">
            {#if isLoading}
                <div class="flex justify-center py-8">
                    <Loader2 class="h-8 w-8 animate-spin text-primary" />
                </div>
            {:else if error}
                <div class="text-red-500 text-center">{error}</div>
            {:else}
                <ExpenseForm {kimpayId} {initialData} />
            {/if}
        </div>
    </main>
</div>
