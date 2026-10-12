<script lang="ts">
    import type { Snippet } from 'svelte';
    import { cn } from '#lib/utils/cn.js';

    type Tone = 'solid' | 'primary' | 'success' | 'warning' | 'neutral';

    let { tone = 'primary', class: className = '', children }: { tone?: Tone; class?: string; children: Snippet } = $props();

    const tones: Record<Tone, string> = {
        solid: 'bg-primary text-primary-foreground',
        primary: 'bg-primary-soft text-primary-soft-foreground',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        neutral: 'bg-muted text-muted-foreground',
    };
</script>

<span class={cn('inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold', tones[tone], className)}>
    {@render children()}
</span>
