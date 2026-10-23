<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import '../app.css';
    import InstallPrompt from "#lib/components/ui/InstallPrompt.svelte";
    import GlobalModals from "#lib/components/GlobalModals.svelte";
    import SiteHeader from "#lib/components/layout/SiteHeader.svelte";
    import Toast from "#lib/components/ui/Toast.svelte";
    import { locale, t } from '#lib/i18n.js';
    import { theme } from '#lib/theme.js';
    import { onMount } from 'svelte';
    import { afterNavigate, beforeNavigate } from '$app/navigation';
    import { page, updated } from '$app/state';
    import type { LayoutProps } from './$types';
    import { recentsStore } from '#lib/stores/recents.svelte.js';
    import { modals } from '#lib/stores/modals.svelte.js';
    import { auth } from '#lib/stores/auth.svelte.js';
    import { storageService } from '#lib/services/storage.js';
    import { offlineStore } from '#lib/stores/offline.svelte.js';
    import { afterLogin } from '#lib/services/session.js';

    let { children, data }: LayoutProps = $props();

    // Expense forms are full-screen, with their own top bar.
    let isFormRoute = $derived(/^\/k\/[^/]+\/(add|edit)(\/|$)/.test(page.url.pathname));

    // The inner scroll container. Since scrolling now happens inside <main>
    // (not the document), reset it to the top on each navigation.
    let mainEl = $state<HTMLElement>();

    afterNavigate((navigation) => {
        // Shallow (a sheet or its panel, opened or closed): same page, same place.
        if (navigation.shallow) return;

        mainEl?.scrollTo({ top: 0 });
    });

    // The scrollbar's width: a panel on the right (computers) covers it, the
    // page under it makes room for the rest.
    $effect(() => {
        const main = mainEl;
        if (!main) return;
        const measure = () => document.documentElement.style.setProperty('--scrollbar-width', `${main.offsetWidth - main.clientWidth}px`);
        const observer = new ResizeObserver(measure);
        observer.observe(main);
        return () => observer.disconnect();
    });

    // A new version was deployed: turn the next navigation into a full page
    // load so the old client never mixes stale chunks with the new build.
    beforeNavigate(({ willUnload, to, shallow, type }) => {
        if (shallow && type === 'goto') return;

        if (updated.current && !willUnload && to?.url) {
            location.href = to.url.href;
        }
    });

    const seo = $derived(data.seo || {
        title: 'Kimpay',
        description: 'Simple expense sharing',
        canonical: 'https://kimpay.io'
    });

    onMount(async () => {
        const migrated = await storageService.migrate();
        theme.init();

        // Writes queued offline in a previous session (app closed before
        // the connection came back): replay them now, once migrated.
        offlineStore.processPendingQueue();
        
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

        auth.loginWithOtp(code).then((success) => {
            if (success) {
                // Remove code from URL
                url.searchParams.delete('code');
                window.history.replaceState({}, '', url);
                afterLogin();
            } else {
                // Invalid or expired code
                url.searchParams.delete('code');
                window.history.replaceState({}, '', url);

                // Don't show the error if we're somehow already logged in.
                if (auth.isValid) return;

                modals.alert({
                    title: $t('auth.magic_link_error_title'),
                    message: $t('auth.magic_link_error_desc'),
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
    <!-- Open Graph tags live in app.html: link previews are fetched without running JS. -->

    <!-- PWA Theme -->
    <!-- The header's color; follows the theme (see lib/theme.ts). -->
    <meta name="theme-color" content="#ffffff" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Kimpay" />
</svelte:head>

<div class="flex flex-col h-dvh overflow-hidden bg-background font-sans text-foreground selection:bg-primary/20">
	<main bind:this={mainEl} class="flex-1 flex flex-col overflow-y-auto" style="scrollbar-gutter: stable;">
		{#if !isFormRoute}
			<SiteHeader />
		{/if}
		{@render children()}
	</main>

</div>

<Toast />
<InstallPrompt />
<GlobalModals />

