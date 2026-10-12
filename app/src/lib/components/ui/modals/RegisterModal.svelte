<script lang="ts">
    import { UserPlus } from "@lucide/svelte";
    import { t, locale } from '#lib/i18n.js';
    import BaseInfoModal from './BaseInfoModal.svelte';
    import { Input } from "#lib/components/ui/input/index.js";
    import { Label } from "#lib/components/ui/label/index.js";
    import { Button } from "#lib/components/ui/button/index.js";
    import { auth } from '#lib/stores/auth.svelte.js';
    import Notice from '#lib/components/ui/Notice.svelte';
    import FieldError from '#lib/components/ui/FieldError.svelte';
    import { isValidEmail } from '#lib/utils/index.js';
    
    interface Props {
        isOpen?: boolean;
        onClose: () => void;
        participantId?: string;
        /** Why an account is asked for (replaces the default description) */
        description?: string | undefined;
    }

    // Mounted only while open (see GlobalModals): state starts fresh each time.
    let { isOpen = false, onClose, participantId = "", description }: Props = $props();
    
    let name = $state("");
    let email = $state("");
    let isLoading = $state(false);
    let error = $state("");
    let success = $state(false);


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
            // An existing account gets a login link instead (same answer).
            error = $t('home.recover.error'); // Reuse generic "Unable to send"
        } finally {
            isLoading = false;
        }
    }
</script>

<BaseInfoModal 
    {isOpen} 
    {onClose}
    title={$t('register.title')}
    description={description || $t('register.desc')}
    icon={UserPlus}

>
    {#if success}
        <Notice title={$t('register.success_title')} description={$t('register.success_desc')} />
        <div class="mt-4">
             <Button variant="outline" class="w-full" onclick={onClose}>{$t('common.got_it')}</Button>
        </div>
    {:else}
        <form onsubmit={handleSubmit} class="space-y-4 pt-1">
            <div class="space-y-3">
                <div class="space-y-2">
                    <Label for="name">{$t('home.create.my_name_label')}</Label>
                    <Input 
                        id="name"
                        placeholder={$t('register.name_placeholder')}
                        bind:value={name}
                        required
                    />
                </div>
                <div class="space-y-2">
                    <Label for="email">{$t('home.create.email_label')}</Label>
                    <Input 
                        id="email"
                        type="email" 
                        placeholder={$t('register.email_placeholder')}
                        bind:value={email}
                        required
                    />
                </div>

                <FieldError message={error} />
            </div>

            <Button type="submit" class="w-full" loading={isLoading} disabled={!email || !name}>
                {$t('register.button')}
            </Button>
        </form>
    {/if}
</BaseInfoModal>
