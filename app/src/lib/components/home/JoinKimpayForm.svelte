<script lang="ts">
    import { Button } from "#lib/components/ui/button/index.js";
    import { Input } from "#lib/components/ui/input/index.js";
    import { LoaderCircle, QrCode } from "@lucide/svelte";
    import { t } from '#lib/i18n.js';
    import ScannerModal from "#lib/components/ui/modals/ScannerModal.svelte";
    import { pb } from '#lib/pocketbase.js';
    import { isKimpayId } from '#lib/utils/id.js';
    import { modals } from '#lib/stores/modals.svelte.js';
    import { goto } from '$app/navigation';
    import { fade } from 'svelte/transition';

    let code = $state("");
    let joinError = $state("");
    let isLoading = $state(false);
    let isScannerOpen = $state(false);

    async function join() {
        if (!code) return;
        isLoading = true;
        joinError = "";
        
        try {
            // Validate existence first
            // Simple cleanup if full url pasted
            const cleanCode = code.includes('/k/') ? code.split('/k/')[1]?.split('/')[0] : code;
            if (!cleanCode) throw new Error("Invalid Code");
            await pb.collection('kimpays').getOne(cleanCode, { requestKey: null });
            await goto(`/k/${cleanCode}`); 
        } catch (_e) {
            joinError = $t('home.join.error_not_found');
        } finally {
            isLoading = false;
        }
    }

    function handleScan(decodedText: string) {
        if (!decodedText) return;
        
        let foundId = "";
        
        // 1. Try URL Regex
        // Matches .../k/RECORDID...
        const urlMatch = decodedText.match(/\/k\/([a-zA-Z0-9]{15})/);
        if (urlMatch && urlMatch[1]) {
            foundId = urlMatch[1];
        } 
        // 2. Check if raw ID (PocketBase standard: 15 chars alphanumeric)
        else if (isKimpayId(decodedText)) {
            foundId = decodedText;
        }

        if (foundId) {
            code = foundId;
            isScannerOpen = false;
            join(); // Auto join
        } else {
            modals.alert({ message: $t('join.invalid_qr'), variant: 'error' });
            isScannerOpen = false;
        }
    }
     
</script>

<div class="space-y-2">
    <label for="join-code" class="block text-sm font-semibold leading-6 text-muted-foreground">{$t('home.join.label')}</label>
    <div class="flex gap-2">
        <Input
            id="join-code"
            bind:value={code}
            placeholder={$t('home.join.placeholder')}
            class={joinError ? 'border-destructive focus-visible:ring-destructive' : ''}
            aria-invalid={!!joinError}
            oninput={() => joinError = ""}
            onkeydown={(e) => e.key === 'Enter' && join()}
        />
        <Button
            variant="outline"
            size="icon"
            class="shrink-0"
            onclick={() => isScannerOpen = true}
            aria-label={$t('join.scan_qr')}
            title={$t('join.scan_qr')}
        >
            <QrCode />
        </Button>
    </div>
    {#if joinError}
        <p class="text-sm font-medium text-destructive" transition:fade>{joinError}</p>
    {/if}
    <Button onclick={join} class="w-full" size="lg" disabled={isLoading || !code.trim()}>
        {#if isLoading}
            <LoaderCircle class="animate-spin" />
        {/if}
        {$t('home.join.button')}
    </Button>
</div>

<ScannerModal
    isOpen={isScannerOpen}
    onScan={handleScan}
    onClose={() => isScannerOpen = false}
/>
