<script lang="ts">
    import { t } from '$lib/i18n';
    import { History as HistoryIcon, CheckCircle } from "lucide-svelte";
    import { slide } from 'svelte/transition';
    import MagicLinkForm from '$lib/components/auth/MagicLinkForm.svelte';

    let success = $state(false);

    function onSuccess() {
        success = true;
    }
</script>

<div class="w-full animate-in fade-in slide-in-from-bottom-4 duration-700 mb-12">
    <div class="flex items-center py-6">
        <div class="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
        <span class="px-4 text-xs uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-2">
            <HistoryIcon class="h-4 w-4" />
            {$t('home.recover.title', { default: 'Recover my kimpays' })}
        </span>
        <div class="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
    </div>
    
    <div>
        {#if success}
            <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3 text-green-700 dark:text-green-300" transition:slide>
                <CheckCircle class="h-5 w-5 shrink-0" />
                <div class="text-sm">
                    <p class="font-medium">{$t('home.recover.success_title', { default: 'Link sent!' })}</p>
                    <p class="text-xs opacity-90">{$t('home.recover.success_desc', { default: 'Check your email inbox.' })}</p>
                </div>
            </div>
        {:else}
            <MagicLinkForm 
                buttonTextKey="home.recover.button"
                successCallback={onSuccess}
            />
        {/if}
    </div>
</div>
