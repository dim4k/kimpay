<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
    import InstallPrompt from "$lib/components/ui/InstallPrompt.svelte";
    import GlobalModals from "$lib/components/GlobalModals.svelte";
    import SiteHeader from "$lib/components/layout/SiteHeader.svelte";
    import { locale } from '$lib/i18n';
    import { theme } from '$lib/theme';
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import { appState } from '$lib/stores/appState.svelte';

    let { children, data } = $props();

    const seo = $derived(data.seo || {
        title: 'Kimpay',
        description: 'Simple expense sharing',
        canonical: 'https://kimpay.io',
        ogImage: 'https://kimpay.io/og-image.png'
    });
    
    onMount(() => {
        theme.init();
        appState.initRecentKimpays();

        if ('serviceWorker' in navigator && import.meta.env.PROD) {
            navigator.serviceWorker.register('/service-worker.js');
        }
    });

    // Re-load groups on navigation (in case a new one was created)
    $effect(() => {
        if (page.url.pathname) {
            appState.initRecentKimpays();
            
            // Reset app state if we leave the kimpay context
            if (!page.url.pathname.startsWith('/k/')) {
                appState.reset();
            }
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

<div class="flex flex-col min-h-screen bg-background font-sans text-foreground selection:bg-primary/20 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-300">
	<SiteHeader />

	<main class="flex-1 flex flex-col pt-16 animate-in fade-in duration-500 slide-in-from-bottom-4">
		{@render children()}
	</main>

</div>

<InstallPrompt />
<GlobalModals />
