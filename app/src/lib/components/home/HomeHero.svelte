<script lang="ts">
    import Logo from "$lib/components/ui/Logo.svelte";
    import { t } from '$lib/i18n';
</script>

<div class="text-center space-y-2 md:space-y-4 mb-6 md:mb-10 animate-slide-up">
    <!-- Hero Logo (Larger) -->
    <div class="inline-flex items-center justify-center p-4 md:p-6 bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl shadow-indigo-100 dark:shadow-none mb-2 md:mb-4 transition-all duration-500 hover:scale-105">
        <Logo class="w-12 h-12 md:w-20 md:h-20 text-indigo-700 dark:text-indigo-400" />
    </div>
    <h1 class="text-2xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">{$t('app.name')}</h1>
    <p class="text-sm md:text-lg text-muted-foreground max-w-[280px] mx-auto leading-relaxed">{$t('app.slogan')}</p>
</div>
