<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
    import InstallPrompt from "$lib/components/ui/InstallPrompt.svelte";
    import SyncIndicator from "$lib/components/ui/SyncIndicator.svelte";
    import GlobalModals from "$lib/components/GlobalModals.svelte";
    import SiteHeader from "$lib/components/layout/SiteHeader.svelte";
    import { locale, t } from '$lib/i18n';
    import { theme } from '$lib/theme';
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import { recentsService } from '$lib/services/recents.svelte';
    import { modals } from '$lib/stores/modals.svelte';
    import { auth } from '$lib/stores/auth.svelte';

    let { children, data } = $props();

    const seo = $derived(data.seo || {
        title: 'Kimpay',
        description: 'Simple expense sharing',
        canonical: 'https://kimpay.io',
        ogImage: 'https://kimpay.io/og-image.png'
    });
    
    onMount(() => {
        theme.init();
        recentsService.init();
        auth.init();
        
        if ('serviceWorker' in navigator && import.meta.env.PROD) {
            navigator.serviceWorker.register('/service-worker.js');
        }
    });

    // Handle Magic Link Token or OTP
    $effect(() => {
        const url = new URL(window.location.href);
        const token = url.searchParams.get('token');
        const code = url.searchParams.get('code');

        if (code) {
             auth.loginWithOtp(code).then(success => {
                if (success) {
                    // Remove code from URL
                    url.searchParams.delete('code');
                    window.history.replaceState({}, '', url);
                    console.log("Logged in via OTP");
                } else {
                    // Invalid or expired code
                    url.searchParams.delete('code');
                    window.history.replaceState({}, '', url);
                    
                    modals.alert({
                        title: $t('auth.magic_link_error_title', { default: 'Invalid Link' }),
                        message: $t('auth.magic_link_error_desc', { default: 'This link is invalid or has expired. Please request a new one.' }),
                        variant: 'error'
                    });
                }
             });
        } else if (token) {
            // Legacy support during transition (or if old emails are still out there)
            auth.loginWithToken(token).then(success => {
                if (success) {
                    url.searchParams.delete('token');
                    window.history.replaceState({}, '', url);
                    console.log("Logged in via Magic Link");
                }
            });
        }
    });

    // Re-load groups on navigation (in case a new one was created)
    $effect(() => {
        if (page.url.pathname) {
            recentsService.init();
            
            // Stores are reset by their init methods when entering a kimpay context.
            // Explicit reset on exit is optional but nice. For now we skip it.
        }
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

<SyncIndicator />
<InstallPrompt />
<GlobalModals />

