<script lang="ts">
    import type { Snippet } from 'svelte';
    import { cn } from '#lib/utils/cn.js';

    type Size = 'sm' | 'md' | 'lg';
    type Tone = 'muted' | 'card' | 'primary' | 'success' | 'danger';

    /**
     * The square holding an emoji or an icon in front of a row (settings,
     * expenses, groups...). Three sizes only: sm in dense lists, md for list
     * items, lg for the heading of a screen.
     */
    let {
        size = 'md',
        tone = 'muted',
        class: className = '',
        children,
    }: { size?: Size; tone?: Tone; class?: string; children: Snippet } = $props();

    const sizes: Record<Size, string> = {
        sm: 'h-8 w-8 text-base [&_svg]:size-4',
        md: 'h-10 w-10 text-xl [&_svg]:size-5',
        lg: 'h-13 w-13 text-3xl [&_svg]:size-6',
    };
    const tones: Record<Tone, string> = {
        muted: 'bg-muted text-muted-foreground',
        card: 'border bg-card',
        primary: 'bg-primary-soft text-primary-soft-foreground',
        success: 'bg-success-soft text-success',
        danger: 'bg-destructive/10 text-destructive',
    };
</script>

<span class={cn('flex shrink-0 items-center justify-center rounded-control', sizes[size], tones[tone], className)} aria-hidden="true">
    {@render children()}
</span>
