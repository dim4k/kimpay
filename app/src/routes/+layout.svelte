<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
    import InstallPrompt from "$lib/components/ui/InstallPrompt.svelte";
    import GlobalModals from "$lib/components/GlobalModals.svelte";
    import SiteHeader from "$lib/components/layout/SiteHeader.svelte";
    import Toast from "$lib/components/ui/Toast.svelte";
    import { locale, t } from '$lib/i18n';
    import { theme } from '$lib/theme';
    import { onMount } from 'svelte';
    import { recentsStore } from '$lib/stores/recents.svelte';
    import { modals } from '$lib/stores/modals.svelte';
    import { auth } from '$lib/stores/auth.svelte';
    import { storageService } from '$lib/services/storage';
    import { participantService } from '$lib/services/participant';

    let { children, data } = $props();

    const seo = $derived(data.seo || {
        title: 'Kimpay',
        description: 'Simple expense sharing',
        canonical: 'https://kimpay.io',
        ogImage: 'https://kimpay.io/og-image.png'
    });

    /**
     * After a successful login, if the user is currently on a Kimpay page with a participant
     * identity, automatically claim that participant for their account.
     */
    async function tryClaimCurrentParticipant() {
        // loginWithOtp has already saved the auth session synchronously, so the
        // user is available right away — no need to wait for a tick.
        const user = auth.user;
        if (!user) return;
        
        // Get ALL kimpays where this device has a participant identity
        const recentKimpayIds = await storageService.getRecentKimpayIds();
        
        for (const kimpayId of recentKimpayIds) {
            const participantId = await storageService.getMyParticipantId(kimpayId);
            if (!participantId) continue;
            
            try {
                await participantService.claim(participantId, kimpayId, user.id);
            } catch (e) {
                console.error("Failed to auto-claim participant", kimpayId, e);
            }
        }
        
        // Reload stores to reflect the claimed kimpays
        recentsStore.init(true);
    }
    
    onMount(async () => {
        const migrated = await storageService.migrate();
        theme.init();
        
        // Single entry point for recents init. Force reload if a data migration
        // just happened so the freshly-migrated Kimpays are picked up.
        recentsStore.init(migrated);
        auth.init();
        
        if ('serviceWorker' in navigator && import.meta.env.PROD) {
            navigator.serviceWorker.register('/service-worker.js');
        }
    });

    // Handle Magic Link OTP code
    let handledAuthParam = false;
    $effect(() => {
        if (handledAuthParam) return;

        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');

        if (!code) return;
        // Ensure we only attempt the login once per page load, even if this
        // effect re-runs. Otherwise a second verify call could fail and show
        // a false "Invalid Link" error after a successful login.
        handledAuthParam = true;

        auth.loginWithOtp(code).then(success => {
            if (success) {
                // Remove code from URL
                url.searchParams.delete('code');
                window.history.replaceState({}, '', url);
                // Auto-claim participant if on a Kimpay page
                tryClaimCurrentParticipant();
            } else {
                // Invalid or expired code
                url.searchParams.delete('code');
                window.history.replaceState({}, '', url);

                // Don't show the error if we're somehow already logged in.
                if (auth.isValid) return;

                modals.alert({
                    title: $t('auth.magic_link_error_title', { default: 'Invalid Link' }),
                    message: $t('auth.magic_link_error_desc', { default: 'This link is invalid or has expired. Please request a new one.' }),
                    variant: 'error'
                });
            }
        });
    });

    locale.subscribe((val) => {
        if (typeof document !== 'undefined') {
            document.documentElement.lang = val;
        }
    });
</script>

<svelte:head>
	<link rel="icon" href={favicon} type="image/svg+xml" />
    <link rel="alternate icon" href="/favicon.ico" />
    <link rel="manifest" href="/manifest.json" />
    
    <!-- Primary Meta Tags -->
    <title>{seo.title}</title>
    <meta name="title" content={seo.title} />
    <meta name="description" content={seo.description} />
    <meta name="keywords" content={seo.keywords} />
    <meta name="author" content="Kimpay" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href={seo.canonical} />
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content={seo.ogType} />
    <meta property="og:url" content={seo.canonical} />
    <meta property="og:title" content={seo.title} />
    <meta property="og:description" content={seo.description} />
    <meta property="og:image" content={seo.ogImage} />
    <meta property="og:locale" content={seo.locale} />
    <meta property="og:locale:alternate" content={seo.alternateLocales[0]} />
    
    <!-- Twitter -->
    <meta property="twitter:card" content={seo.twitterCard} />
    <meta property="twitter:url" content={seo.canonical} />
    <meta property="twitter:title" content={seo.title} />
    <meta property="twitter:description" content={seo.description} />
    <meta property="twitter:image" content={seo.ogImage} />
    
    <!-- PWA Theme -->
    <meta name="theme-color" content="#4f46e5" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Kimpay" />
</svelte:head>

<div class="flex flex-col min-h-screen bg-background font-sans text-foreground selection:bg-primary/20 dark:bg-slate-950 dark:text-slate-100">
	<SiteHeader />

	<main class="flex-1 flex flex-col pt-16">
		{@render children()}
	</main>

</div>

<Toast />
<InstallPrompt />
<GlobalModals />

