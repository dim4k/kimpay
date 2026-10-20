<script lang="ts">
    import { Trash2, type LucideProps } from "@lucide/svelte";
    import type { Component, Snippet } from 'svelte';
    import { haptic } from '#lib/utils/haptic.js';
    import { t } from '#lib/i18n.js';

    /**
     * A row swiped to the left for one action: delete (red) by default, or a
     * gentler one that can be undone, like archiving (neutral).
     */
    interface Props {
        /** No swipe (e.g. offline, where the action is unavailable) */
        disabled?: boolean;
        /** The action, once swiped far enough */
        onAction?: () => void;
        /** Label and icon of the action (default: delete) */
        label?: string;
        icon?: Component<LucideProps>;
        /** `danger` for what cannot be undone, `neutral` otherwise */
        tone?: 'danger' | 'neutral';
        /** Optional style string for the container */
        style?: string;
        children: Snippet;
    }

    let {
        disabled = false,
        onAction,
        label,
        icon: Icon = Trash2,
        tone = 'danger',
        style = '',
        children
    }: Props = $props();

    // Swipe state
    let offsetX = $state(0);
    let startX = 0;
    let startY = 0;
    let isSwiping = $state(false);
    let hasTriggeredHaptic = false;
    let isVerticalScroll = false;

    // Thresholds (lower = easier to trigger)
    const REVEAL_THRESHOLD = 40;
    const TRIGGER_THRESHOLD = 70;
    const MAX_OFFSET = 90;

    function handleTouchStart(e: TouchEvent) {
        if (disabled || !onAction) return;
        const touch = e.touches[0];
        if (!touch) return;

        startX = touch.clientX;
        startY = touch.clientY;
        isSwiping = false;
        isVerticalScroll = false;
        hasTriggeredHaptic = false;
    }

    function handleTouchMove(e: TouchEvent) {
        if (disabled || !onAction || isVerticalScroll) return;
        const touch = e.touches[0];
        if (!touch) return;

        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;

        // A vertical scroll first: not a swipe.
        if (!isSwiping && Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
            isVerticalScroll = true;
            return;
        }

        // To the left only, past a few pixels.
        if (deltaX < -10) isSwiping = true;
        if (!isSwiping) return;

        offsetX = Math.min(0, Math.max(deltaX, -MAX_OFFSET));
        if (!hasTriggeredHaptic && -offsetX >= REVEAL_THRESHOLD) {
            haptic('light');
            hasTriggeredHaptic = true;
        }
    }

    function handleTouchEnd() {
        if (isVerticalScroll) {
            isVerticalScroll = false;
            return;
        }
        if (isSwiping && -offsetX >= TRIGGER_THRESHOLD) {
            haptic('medium');
            onAction?.();
        }
        resetSwipe();
    }

    function resetSwipe() {
        offsetX = 0;
        isSwiping = false;
        hasTriggeredHaptic = false;
    }

    let contentStyle = $derived(`transform: translateX(${offsetX}px); transition: ${isSwiping ? 'none' : 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'};`);
    let showAction = $derived(isSwiping && offsetX < -10);
    let actionOpacity = $derived(showAction ? Math.min(-offsetX / REVEAL_THRESHOLD, 1) : 0);
</script>


<!-- A row of a ListGroup: rounds its own corners so the revealed action
     follows the group's shape. -->
<div class="relative touch-pan-y overflow-clip first:rounded-t-[inherit] last:rounded-b-[inherit]" {style}>
    {#if showAction}
        <div
            class="absolute inset-0 flex items-center justify-end pr-5 {tone === 'danger' ? 'bg-destructive text-destructive-foreground' : 'bg-muted-foreground text-card'}"
            style="opacity: {actionOpacity};"
        >
            <div class="flex flex-col items-center gap-1">
                <Icon class="h-6 w-6" />
                <span class="text-xs font-medium">{label ?? $t('common.delete')}</span>
            </div>
        </div>
    {/if}

    <div
        class="relative z-10 bg-card will-change-transform"
        role="group"
        style={contentStyle}
        ontouchstart={handleTouchStart}
        ontouchmove={handleTouchMove}
        ontouchend={handleTouchEnd}
        ontouchcancel={resetSwipe}
    >
        {@render children()}
    </div>
</div>
