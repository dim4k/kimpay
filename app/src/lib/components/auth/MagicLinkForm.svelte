<script lang="ts">
    import { Input } from "#lib/components/ui/input/index.js";
    import { Button } from "#lib/components/ui/button/index.js";
    import { t, locale, type TranslationKey } from '#lib/i18n.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { Mail, LoaderCircle } from "@lucide/svelte";
    import Notice from '#lib/components/ui/Notice.svelte';
    import FieldError from '#lib/components/ui/FieldError.svelte';
    import { isValidEmail } from '#lib/utils/index.js';

    interface Props {
        buttonTextKey?: TranslationKey;
        successCallback?: () => void;
    }

    let { buttonTextKey = 'home.recover.button', successCallback }: Props = $props();

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
            // The endpoint always responds 200 for valid requests (to avoid
            // email enumeration), so any error here is a genuine failure.
            console.error(e);
            error = $t('home.recover.error');
        } finally {
            isLoading = false;
        }
    }
</script>

{#if success}
    <Notice title={$t('home.recover.success_title')} description={$t('home.recover.success_desc')} />
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

            <FieldError message={error} />
        </div>

        <Button type="submit" variant="outline" class="w-full" disabled={isLoading || !email}>
            {#if isLoading}
                <LoaderCircle class="h-4 w-4 animate-spin mr-2" />
            {/if}
            {$t(buttonTextKey)}
        </Button>
    </form>
{/if}
