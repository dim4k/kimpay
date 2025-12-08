<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { scale } from 'svelte/transition';
    import { AlertCircle } from "lucide-svelte";

    let { isOpen, title, message, onConfirm }: { 
        isOpen: boolean; 
        title?: string;
        message: string; 
        onConfirm: () => void; 
    } = $props();
</script>

{#if isOpen}
    <div 
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
    >
        <div 
            class="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-6 dark:border dark:border-slate-800 transition-colors" 
            transition:scale={{ start: 0.95, opacity: 0 }}
        >
            <div class="flex flex-col items-center gap-4 text-center">
                <div class="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                    <AlertCircle class="h-6 w-6" />
                </div>
                
                <div class="space-y-1">
                    {#if title}
                        <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
                    {/if}
                    <p class="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                        {message}
                    </p>
                </div>
            </div>

            <div class="flex gap-3 justify-center">
                <Button class="w-full rounded-xl" onclick={onConfirm}>
                    OK
                </Button>
            </div>
        </div>
    </div>
{/if}
