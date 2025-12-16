<script lang="ts">
    import { Input } from "$lib/components/ui/input";
    import { Button } from "$lib/components/ui/button";
    import { t, locale } from '$lib/i18n';
    import { auth } from '$lib/stores/auth.svelte';
    import { Mail, LoaderCircle, AlertCircle, CheckCircle } from "lucide-svelte";
    import { slide } from 'svelte/transition';
    import { isValidEmail } from '$lib/utils';

    let { 
        buttonTextKey = 'home.recover.button',
        successCallback
    } = $props<{
        buttonTextKey?: string;
        successCallback?: () => void;
    }>();

    let email = $state("");
    let isLoading = $state(false);
    let error = $state("");
    let success = $state(false);

    async function handleSubmit(e: Event) {
        e.preventDefault();
        if (!email || !isValidEmail(email)) return;

        isLoading = true;
        error = "";
        success = false;

        try {
            await auth.requestMagicLink(email, $locale);
            success = true;
            email = ""; 
            successCallback?.();
        } catch (e) {
            console.error(e);
            if (typeof e === 'object' && e !== null && 'status' in e && (e as { status: number }).status === 404) {
                error = $t('home.recover.error_not_found');
            } else {
                error = $t('home.recover.error');
            }
        } finally {
            isLoading = false;
        }
    }
</script>

{#if success}
    <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3 text-green-700 dark:text-green-300" transition:slide>
        <CheckCircle class="h-5 w-5 shrink-0" />
        <div class="text-sm">
            <p class="font-medium">{$t('home.recover.success_title', { default: 'Link sent!' })}</p>
            <p class="text-xs opacity-90">{$t('home.recover.success_desc', { default: 'Check your email inbox.' })}</p>
        </div>
    </div>
{:else}
    <form onsubmit={handleSubmit} class="space-y-3">
        <div class="space-y-2">
            <div class="relative">
                <Mail class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    type="email" 
                    placeholder="name@example.com" 
                    bind:value={email}
                    class="pl-9"
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

        <Button type="submit" variant="outline" class="w-full" disabled={isLoading || !email}>
            {#if isLoading}
                <LoaderCircle class="h-4 w-4 animate-spin mr-2" />
            {/if}
            {$t(buttonTextKey)}
        </Button>
    </form>
{/if}
