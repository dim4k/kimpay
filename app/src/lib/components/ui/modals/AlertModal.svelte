<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { CircleAlert, Info } from "lucide-svelte";
    import Modal from './Modal.svelte';
    
    let { isOpen, title, message, variant = 'error', onConfirm }: { 
        isOpen: boolean; 
        title?: string;
        message: string; 
        variant?: 'error' | 'info';
        onConfirm: () => void; 
    } = $props();
</script>

<Modal {isOpen} onClose={onConfirm}>
    <div class="flex flex-col items-center gap-4 text-center">
        {#if variant === 'error'}
            <div class="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                <CircleAlert class="h-6 w-6" />
            </div>
        {:else}
                <div class="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Info class="h-6 w-6" />
            </div>
        {/if}
        
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
</Modal>
