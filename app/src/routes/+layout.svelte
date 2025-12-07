<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
    import { Languages, ChevronDown, Check, Sun, Moon } from "lucide-svelte";
    import Logo from "$lib/components/ui/Logo.svelte";
    import InstallPrompt from "$lib/components/ui/InstallPrompt.svelte";
    import GlobalModals from "$lib/components/GlobalModals.svelte";
    import { locale } from '$lib/i18n';
    import { theme } from '$lib/theme';
    import { slide } from 'svelte/transition';
    import { onMount } from 'svelte';

	let { children } = $props();
    let isLangMenuOpen = $state(false);

    function setLanguage(lang: string) {
      locale.set(lang);
      isLangMenuOpen = false;
    }

    onMount(() => {
        theme.init();

        if ('serviceWorker' in navigator && import.meta.env.PROD) {
            navigator.serviceWorker.register('/service-worker.js');
        }
    });
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
    <link rel="manifest" href="/manifest.json" />
    <title>Kimpay</title>
</svelte:head>

<div class="flex flex-col min-h-screen bg-background font-sans text-foreground selection:bg-primary/20 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-300">
	<header class="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md dark:bg-slate-900/80 dark:border-slate-800">
		<div class="container flex h-16 items-center justify-between px-4">
			<a href="/" class="flex items-center gap-2 transition-transform hover:scale-105">
				<Logo class="h-8 w-8 text-indigo-700 dark:text-indigo-400" />
				<span class="text-xl font-bold tracking-tight bg-gradient-to-br from-primary to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">Kimpay</span>
			</a>

            <div class="flex items-center gap-2">
                <!-- Theme Toggle -->
                <button 
                    onclick={theme.toggle}
                    class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200"
                    aria-label="Toggle Dark Mode"
                >
                    {#if $theme === 'dark'}
                        <Moon class="h-5 w-5" />
                    {:else}
                        <Sun class="h-5 w-5" />
                    {/if}
                </button>

                <!-- Language Dropdown -->
                <div class="relative">
                    <button 
                        onclick={() => isLangMenuOpen = !isLangMenuOpen}
                        class="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm font-medium text-slate-700 dark:text-slate-200"
                    >
                        <Languages class="h-4 w-4" />
                        <span class="uppercase">{$locale}</span>
                        <ChevronDown class="h-3 w-3 opacity-50 transition-transform {isLangMenuOpen ? 'rotate-180' : ''}" />
                    </button>
      
                    {#if isLangMenuOpen}
                        <div 
                            class="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 py-1 overflow-hidden"
                            transition:slide={{ duration: 200 }}
                        >
                              <button 
                                  class="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between group dark:text-slate-200"
                                  onclick={() => setLanguage('en')}
                              >
                                  <span class="group-hover:text-primary transition-colors">English</span>
                                  {#if $locale === 'en'}
                                      <Check class="h-4 w-4 text-primary" />
                                  {/if}
                              </button>
                              <button 
                                  class="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between group dark:text-slate-200"
                                  onclick={() => setLanguage('fr')}
                              >
                                  <span class="group-hover:text-primary transition-colors">Français</span>
                                  {#if $locale === 'fr'}
                                      <Check class="h-4 w-4 text-primary" />
                                  {/if}
                              </button>
                        </div>
                        <div 
                            class="fixed inset-0 z-[-1]" 
                            onclick={() => isLangMenuOpen = false} 
                            role="button" 
                            tabindex="-1" 
                            onkeydown={(e) => e.key === 'Escape' && (isLangMenuOpen = false)}
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
