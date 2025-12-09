<script lang="ts">
    /* eslint-disable svelte/no-navigation-without-resolve */
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { LoaderCircle, QrCode } from "lucide-svelte";
    import { t } from '$lib/i18n';
    import ScannerModal from "$lib/components/ui/ScannerModal.svelte";
    import { pb } from '$lib/pocketbase';
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
            await pb.collection('kimpays').getOne(cleanCode);
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
        else if (/^[a-zA-Z0-9]{15}$/.test(decodedText)) {
            foundId = decodedText;
        }

        if (foundId) {
            code = foundId;
            isScannerOpen = false;
            join(); // Auto join
        } else {
            // Feedback could be improved, but for now just close and fill text
            alert("QR Code invalide ou lien Kimpay non reconnu.");
            isScannerOpen = false;
        }
    }
     
</script>

<div class="relative py-4">
    <div class="absolute inset-0 flex items-center">
    <span class="w-full border-t border-slate-100"></span>
    </div>
    <div class="relative flex justify-center text-xs uppercase">
    <span class="bg-card px-3 text-muted-foreground font-medium transition-colors">{$t('home.join.title')}</span>
    </div>
</div>

<div class="flex flex-col gap-2">
    <div class="flex gap-2">
        <Input 
            bind:value={code} 
            placeholder={$t('home.join.placeholder')} 
            class="text-center font-bold uppercase placeholder:font-normal {joinError ? 'border-red-500 ring-red-500' : ''}" 
            oninput={() => joinError = ""}
            onkeydown={(e) => e.key === 'Enter' && join()}
        />
        
        <Button onclick={join} variant="secondary" disabled={isLoading}>
            {#if isLoading}
                <LoaderCircle class="h-4 w-4 animate-spin" />
            {:else}
                {$t('home.join.button')}
            {/if}
        </Button>

        <!-- Mobile Scan Button -->
        <Button 
            variant="outline"
            size="icon"
            class="md:hidden aspect-square shrink-0"
            onclick={() => isScannerOpen = true}
            aria-label="Scan QR Code"
        >
            <QrCode class="h-4 w-4" />
        </Button>
    </div>
    {#if joinError}
        <p class="text-xs text-red-500 text-center font-medium animate-pulse" transition:fade>{joinError}</p>
    {/if}
</div>

<ScannerModal 
    isOpen={isScannerOpen} 
    onScan={handleScan} 
    onClose={() => isScannerOpen = false} 
/>
