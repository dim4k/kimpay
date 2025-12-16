<script lang="ts">
    import { UserPlus, LoaderCircle, AlertCircle, CheckCircle } from "lucide-svelte";
    import { t, locale } from '$lib/i18n';
    import BaseInfoModal from './BaseInfoModal.svelte';
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Button } from "$lib/components/ui/button";
    import { auth } from '$lib/stores/auth.svelte';
    import { slide } from 'svelte/transition';
    import { isValidEmail } from '$lib/utils';
    
    let { 
        isOpen = false, 
        onClose,
        participantId = ""
    } = $props<{
        isOpen?: boolean;
        onClose: () => void;
        participantId?: string;
    }>();
    
    let name = $state("");
    let email = $state("");
    let isLoading = $state(false);
    let error = $state("");
    let success = $state(false);
    
    $effect(() => {
        if (isOpen) {
            success = false;
            error = "";
            name = "";
            email = "";
            isLoading = false;
        }
    });

    async function handleSubmit(e: Event) {
        e.preventDefault();
        if (!email || !isValidEmail(email) || !name) return;

        isLoading = true;
        error = "";

        try {
            await auth.register(email, name, participantId, $locale);
            success = true;
            email = "";
            name = "";
        } catch (e) {
            console.error(e);
            if (typeof e === 'object' && e !== null && 'status' in e && (e as { status: number }).status === 409) {
                 error = $t('register.error_exists');
            } else {
                 error = $t('home.recover.error'); // Reuse generic "Unable to send"
            }
        } finally {
            isLoading = false;
        }
    }
</script>

<BaseInfoModal 
    {isOpen} 
    {onClose}
    title={$t('register.title')}
    description={$t('register.desc')}
    icon={UserPlus}
    iconBgClass="bg-indigo-100 dark:bg-indigo-900/30"
    iconColorClass="text-indigo-500 dark:text-indigo-400"
>
    {#if success}
        <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3 text-green-700 dark:text-green-300" transition:slide>
            <CheckCircle class="h-5 w-5 shrink-0" />
            <div class="text-sm">
                <p class="font-medium">{$t('register.success_title')}</p>
                <p class="text-xs opacity-90">{$t('register.success_desc')}</p>
            </div>
        </div>
        <div class="mt-4">
             <Button variant="outline" class="w-full" onclick={onClose}>{$t('common.got_it')}</Button>
        </div>
    {:else}
        <form onsubmit={handleSubmit} class="space-y-4 pt-1">
            <div class="space-y-3">
                <div class="space-y-1">
                    <Label for="name" class="text-xs">{$t('home.create.my_name_label')}</Label>
                    <Input 
                        id="name"
                        placeholder={$t('register.name_placeholder')}
                        bind:value={name}
                        required
                    />
                </div>
                <div class="space-y-1">
                    <Label for="email" class="text-xs">{$t('home.create.email_label')}</Label>
                    <Input 
                        id="email"
                        type="email" 
                        placeholder={$t('register.email_placeholder')}
                        bind:value={email}
                        required
                    />
                </div>

                {#if error}
                    <div class="flex items-center gap-2 text-xs text-red-500" transition:slide>
                        <AlertCircle class="h-3 w-3" />
                        <span>{error}</span>
                    </div>
                {/if}
            </div>

            <Button type="submit" class="w-full" disabled={isLoading || !email || !name}>
                {#if isLoading}
                    <LoaderCircle class="h-4 w-4 animate-spin mr-2" />
                {/if}
                {$t('register.button')}
            </Button>
        </form>
    {/if}
</BaseInfoModal>
