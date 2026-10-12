<script lang="ts">
    import { t } from '#lib/i18n.js';
</script>

<!-- The header already carries the logo: the hero says what the app does. -->
<div class="space-y-2 pt-2 text-center animate-slide-up">
    <h1 class="text-3xl font-bold tracking-tight text-balance">{$t('app.slogan')}</h1>
    <p class="mx-auto max-w-sm text-base text-muted-foreground">{$t('home.hero.desc')}</p>
</div>
