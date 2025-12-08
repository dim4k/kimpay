<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
    import { Languages, ChevronDown, Check, Sun, Moon, Menu, Home, Plus } from "lucide-svelte";
    import Logo from "$lib/components/ui/Logo.svelte";
    import InstallPrompt from "$lib/components/ui/InstallPrompt.svelte";
    import GlobalModals from "$lib/components/GlobalModals.svelte";
    import { locale, t } from '$lib/i18n';
    import { theme } from '$lib/theme';
    import { slide } from 'svelte/transition';
    import { onMount } from 'svelte';
    import { pb } from '$lib/pocketbase';
    import { page } from '$app/stores';

	let { children } = $props();
    let isMenuOpen = $state(false);
    let isLangOptionsOpen = $state(false);
    let recentKimpays = $state<any[]>([]);

    async function loadGroups() {
        try {
             // Only run in browser
            if (typeof localStorage === 'undefined') return;

            const myKimpays = JSON.parse(localStorage.getItem('my_kimpays') || "{}");
            // Filter only valid IDs (15 chars)
            const ids = Object.keys(myKimpays).filter(id => id && /^[a-zA-Z0-9]{15}$/.test(id));
            
            if (ids.length === 0) {
                recentKimpays = [];
                return;
            }

            // Fetch safely
            const promises = ids.map(id => pb.collection('kimpays').getOne(id, { requestKey: null }).catch(() => null));
            const items = (await Promise.all(promises)).filter(i => i !== null);
            
            // Sort by updated? Or just keeping order is fine. 
            // Reverse to show newest? Localstorage keys order is undefined mostly.
            // Let's rely on the fetch order which matches keys order.
            recentKimpays = items;
        } catch (e) {
            console.error("Failed to load groups in layout", e);
        }
    }

    onMount(() => {
        theme.init();
        loadGroups();

        if ('serviceWorker' in navigator && import.meta.env.PROD) {
            navigator.serviceWorker.register('/service-worker.js');
        }
    });

    // Re-load groups on navigation (in case a new one was created)
    // We can use the page store to detect path changes
    $effect(() => {
        if ($page.url.pathname) {
            loadGroups();
        }
    });

    locale.subscribe((val) => {
        if (typeof document !== 'undefined') {
            document.documentElement.lang = val;
        }
    });
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
    <link rel="manifest" href="/manifest.json" />
    
    <!-- Primary Meta Tags -->
    <title>Kimpay - Simple Expense Sharing for Groups</title>
    <meta name="title" content="Kimpay - Simple Expense Sharing for Groups" />
    <meta name="description" content="Split expenses easily with friends and family. Create a group in seconds, track shared costs, and settle debts with smart balance calculations. Free, fast, and delightful to use." />
    <meta name="keywords" content="expense sharing, split bills, group expenses, travel expenses, shared costs, tricount alternative, splitwise, expense tracker, debt calculator" />
    <meta name="author" content="Kimpay" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="https://kimpay.io" />
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://kimpay.io" />
    <meta property="og:title" content="Kimpay - Simple Expense Sharing for Groups" />
    <meta property="og:description" content="Split expenses easily with friends and family. Create a group in seconds, track shared costs, and settle debts with smart balance calculations." />
    <meta property="og:image" content="https://kimpay.io/og-image.png" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:locale:alternate" content="fr_FR" />
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="https://kimpay.io" />
    <meta property="twitter:title" content="Kimpay - Simple Expense Sharing for Groups" />
    <meta property="twitter:description" content="Split expenses easily with friends and family. Create a group in seconds, track shared costs, and settle debts with smart balance calculations." />
    <meta property="twitter:image" content="https://kimpay.io/og-image.png" />
    
    <!-- PWA Theme -->
    <meta name="theme-color" content="#4f46e5" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Kimpay" />
</svelte:head>

<div class="flex flex-col min-h-screen bg-background font-sans text-foreground selection:bg-primary/20 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-300">
	<header class="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md dark:bg-slate-900/80 dark:border-slate-800">
		<div class="container flex h-16 items-center justify-between px-4">
			<a href="/" class="flex items-center gap-2 transition-transform hover:scale-105">
				<Logo class="h-8 w-8 text-indigo-700 dark:text-indigo-400" />
				<span class="text-xl font-bold tracking-tight bg-gradient-to-br from-primary to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">Kimpay</span>
			</a>

            <div class="flex items-center gap-2">
                <!-- Burger Menu -->
                <div class="relative">
                    <button 
                        onclick={() => isMenuOpen = !isMenuOpen}
                        class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200"
                        title="Menu"
                    >
                        <Menu class="h-6 w-6" />
                    </button>

                    {#if isMenuOpen}
                         <div 
                             class="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col"
                             transition:slide={{ duration: 200 }}
                         >
                            <!-- Main Navigation Section -->
                            <div class="max-h-[50vh] overflow-y-auto py-2">
                                <div class="px-4 py-2 text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-between">
                                    {$t('home.history.title')}
                                </div>
                                
                                {#if recentKimpays.length === 0}
                                    <div class="px-4 py-3 text-sm text-slate-500 italic text-center">
                                        {$t('expense.list.empty.title')}
                                    </div>
                                {:else}
                                    {#each recentKimpays as k}
                                        <a 
                                            href="/k/{k.id}" 
                                            class="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                            onclick={() => isMenuOpen = false}
                                        >
                                            <span class="text-xl">{k.icon || "📁"}</span>
                                            <span class="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{k.name}</span>
                                        </a>
                                    {/each}
                                {/if}

                                <div class="h-px bg-slate-100 dark:bg-slate-800 my-2"></div>
                                
                                <a 
                                    href="/"
                                    class="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-indigo-600 dark:text-indigo-400"
                                    onclick={() => isMenuOpen = false}
                                >
                                    <Plus class="h-4 w-4" />
                                    <span class="text-sm font-semibold">{$t('home.create.title')}</span>
                                </a>
                            </div>

                            <!-- Settings Section (Bottom) -->
                            <div class="bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 p-2 space-y-1">
                                <!-- Theme Toggle -->
                                <button 
                                    onclick={theme.toggle}
                                    class="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors group"
                                >
                                    <div class="flex items-center gap-3 text-slate-600 dark:text-slate-400 font-medium text-sm">
                                        {#if $theme === 'dark'}
                                            <Moon class="h-4 w-4" />
                                        {:else}
                                            <Sun class="h-4 w-4" />
                                        {/if}
                                        <span>Theme</span>
                                    </div>
                                    <span class="text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-1 rounded text-slate-500">
                                        {$theme === 'dark' ? 'Dark' : 'Light'}
                                    </span>
                                </button>

                                <!-- Language Selector -->
                                <div class="space-y-1">
                                    <button 
                                        onclick={() => isLangOptionsOpen = !isLangOptionsOpen}
                                        class="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors group"
                                    >
                                        <div class="flex items-center gap-3 text-slate-600 dark:text-slate-400 font-medium text-sm">
                                            <Languages class="h-4 w-4" />
                                            <span>Language</span>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <span class="text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-1 rounded text-slate-500 uppercase">
                                                {$locale}
                                            </span>
                                            <ChevronDown class="h-3 w-3 text-slate-400 transition-transform {isLangOptionsOpen ? 'rotate-180' : ''}" />
                                        </div>
                                    </button>

                                    {#if isLangOptionsOpen}
                                        <div class="pl-2 pr-1 pb-1 space-y-1" transition:slide={{ duration: 150 }}>
                                            <button 
                                                class="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-sm transition-colors {$locale === 'en' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10' : 'text-slate-600 dark:text-slate-400'}"
                                                onclick={() => { locale.set('en'); isLangOptionsOpen = false; }}
                                            >
                                                <span class="font-medium">English</span>
                                                {#if $locale === 'en'} <Check class="h-3 w-3" /> {/if}
                                            </button>
                                            <button 
                                                class="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-sm transition-colors {$locale === 'fr' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10' : 'text-slate-600 dark:text-slate-400'}"
                                                onclick={() => { locale.set('fr'); isLangOptionsOpen = false; }}
                                            >
                                                <span class="font-medium">Français</span>
                                                {#if $locale === 'fr'} <Check class="h-3 w-3" /> {/if}
                                            </button>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                         </div>
                         <div 
                             class="fixed inset-0 z-[-1]" 
                             onclick={() => isMenuOpen = false} 
                             role="button" 
                             tabindex="-1" 
                             onkeydown={(e) => e.key === 'Escape' && (isMenuOpen = false)}
                         ></div>
                    {/if}
                </div>
            </div>
		</div>
	</header>

	<main class="flex-1 flex flex-col pt-16 animate-in fade-in duration-500 slide-in-from-bottom-4">
		{@render children()}
	</main>

    <InstallPrompt />
    <GlobalModals />
</div>
