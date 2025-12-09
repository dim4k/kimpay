<!-- eslint-disable svelte/no-navigation-without-resolve -->
<script lang="ts">
  /* eslint-disable svelte/no-navigation-without-resolve */
  import { page } from '$app/stores';
  import { t } from '$lib/i18n';
  import { Home } from "lucide-svelte";
</script>

<div class="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 transition-colors relative overflow-hidden">
    
    <!-- Animated background elements -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute top-[20%] left-[10%] text-6xl opacity-20 animate-bounce duration-[3000ms]">🪐</div>
        <div class="absolute bottom-[20%] right-[10%] text-4xl opacity-20 animate-pulse">✨</div>
        <div class="absolute top-[10%] right-[20%] text-2xl opacity-10 animate-ping">⭐</div>
        <div class="absolute bottom-[30%] left-[20%] text-8xl opacity-5 dark:opacity-10 rotate-12">🚀</div>
    </div>

    <div class="relative z-10 space-y-6 max-w-md mx-auto">
        <h1 class="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-pulse">
            404
        </h1>
        
        <div class="space-y-2">
            <h2 class="text-3xl font-bold">{$t('error.404.title')}</h2>
            <p class="text-lg text-slate-500 dark:text-slate-400">
                {$t('error.404.desc')}
            </p>
        </div>

        <div class="pt-8">
            <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
            <a 
                href="/" 
                class="inline-flex items-center gap-2 px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full font-bold shadow-lg hover:scale-105 hover:shadow-xl transition-all duration-300"
            >
                <Home class="w-5 h-5" />
                {$t('error.404.button')}
            </a>
        </div>
    </div>

    <div class="absolute bottom-8 text-xs text-slate-400 font-mono">
        Error: {$page.status} {$page.error?.message}
    </div>
</div>
