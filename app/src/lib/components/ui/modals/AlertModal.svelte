<script lang="ts">
    import { Button } from "#lib/components/ui/button/index.js";
    import { CircleAlert, Info, CircleCheck } from "@lucide/svelte";
    import Modal from './Modal.svelte';
    
    let { isOpen, title, message, variant = 'error', onConfirm }: { 
        isOpen: boolean; 
        title?: string;
        message: string; 
        variant?: 'error' | 'info' | 'success';
        onConfirm: () => void; 
    } = $props();
</script>

<Modal {isOpen} onClose={onConfirm}>
    <div class="flex flex-col items-center gap-4 text-center">
        {#if variant === 'error'}
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <CircleAlert class="h-6 w-6" />
            </div>
        {:else if variant === 'success'}
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
                <CircleCheck class="h-6 w-6" />
            </div>
        {:else}
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
                <Info class="h-6 w-6" />
            </div>
        {/if}
        
        <div class="space-y-1">
            {#if title}
                <h2 class="text-lg font-bold">{title}</h2>
            {/if}
            <p class="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {message}
            </p>
        </div>
    </div>

    <div class="flex gap-3 justify-center">
        <Button class="w-full" onclick={onConfirm}>
            OK
        </Button>
    </div>
</Modal>
