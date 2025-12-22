<script lang="ts">
    import { Pencil, Trash2 } from "lucide-svelte";
    import { haptic } from '$lib/utils/haptic';
    import { t } from '$lib/i18n';

    interface Props {
        /** Whether swipe is disabled (e.g. in offline mode for editing) */
        disabled?: boolean;
        /** Called when delete action is triggered */
        onDelete?: () => void;
        /** Called when edit action is triggered */
        onEdit?: () => void;
        /** Optional style string for the container */
        style?: string;
        /** Child content to make swipeable */
        children: import('svelte').Snippet;
    }

    let { 
        disabled = false,
        onDelete,
        onEdit,
        style = '',
        children
    }: Props = $props();

    // Swipe state
    let offsetX = $state(0);
    let startX = $state(0);
    let startY = $state(0);
    let isSwiping = $state(false);
    let direction = $state<'left' | 'right' | null>(null);
    let hasTriggeredHaptic = $state(false);
    let isVerticalScroll = $state(false);

    // Thresholds (lower = easier to trigger)
    const REVEAL_THRESHOLD = 40;
    const TRIGGER_THRESHOLD = 70;
    const MAX_OFFSET = 90;

    function handleTouchStart(e: TouchEvent) {
        if (disabled) return;
        const touch = e.touches[0];
        if (!touch) return;
        
        startX = touch.clientX;
        startY = touch.clientY;
        isSwiping = false;
        isVerticalScroll = false;
        hasTriggeredHaptic = false;
        direction = null;
    }

    function handleTouchMove(e: TouchEvent) {
        if (disabled || isVerticalScroll) return;
        const touch = e.touches[0];
        if (!touch) return;

        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;

        // If vertical scroll detected first, mark it and exit
        if (!isSwiping && Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
            isVerticalScroll = true;
            return;
        }

        // Only start tracking swipe after threshold
        if (Math.abs(deltaX) > 10) {
            isSwiping = true;
        }

        if (isSwiping) {
            // Determine direction
            if (deltaX < 0) {
                direction = 'left';
                offsetX = Math.max(deltaX, -MAX_OFFSET);
            } else {
                direction = 'right';
                offsetX = Math.min(deltaX, MAX_OFFSET);
            }

            // Haptic feedback when crossing reveal threshold
            if (!hasTriggeredHaptic && Math.abs(offsetX) >= REVEAL_THRESHOLD) {
                haptic('light');
                hasTriggeredHaptic = true;
            }
        }
    }

    function handleTouchEnd() {
        if (isVerticalScroll) {
            isVerticalScroll = false;
            return;
        }
        
        if (!isSwiping) {
            resetSwipe();
            return;
        }

        const absOffset = Math.abs(offsetX);

        // Check if action should trigger
        if (absOffset >= TRIGGER_THRESHOLD) {
            haptic('medium');
            if (direction === 'left' && onDelete) {
                onDelete();
            } else if (direction === 'right' && onEdit) {
                onEdit();
            }
        }

        resetSwipe();
    }

    function resetSwipe() {
        offsetX = 0;
        isSwiping = false;
        direction = null;
        hasTriggeredHaptic = false;
    }

    // Computed styles
    let contentStyle = $derived(`transform: translateX(${offsetX}px); transition: ${isSwiping ? 'none' : 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'};`);
    let showLeftAction = $derived(isSwiping && direction === 'left' && Math.abs(offsetX) > 10);
    let showRightAction = $derived(isSwiping && direction === 'right' && offsetX > 10);
    let leftActionOpacity = $derived(showLeftAction ? Math.min(Math.abs(offsetX) / REVEAL_THRESHOLD, 1) : 0);
    let rightActionOpacity = $derived(showRightAction ? Math.min(offsetX / REVEAL_THRESHOLD, 1) : 0);
</script>

<div class="swipeable-container relative" {style}>
    <!-- Delete Action (revealed on swipe left) -->
    {#if showLeftAction}
        <div 
            class="absolute inset-0 flex items-center justify-end pr-5 bg-red-500 text-white rounded-xl"
            style="opacity: {leftActionOpacity};"
        >
            <div class="flex flex-col items-center gap-1">
                <Trash2 class="h-6 w-6" />
                <span class="text-xs font-medium">{$t('common.delete')}</span>
            </div>
        </div>
    {/if}

    <!-- Edit Action (revealed on swipe right) -->
    {#if showRightAction}
        <div 
            class="absolute inset-0 flex items-center justify-start pl-5 bg-indigo-500 text-white rounded-xl"
            style="opacity: {rightActionOpacity};"
        >
            <div class="flex flex-col items-center gap-1">
                <Pencil class="h-6 w-6" />
                <span class="text-xs font-medium">{$t('common.edit')}</span>
            </div>
        </div>
    {/if}

    <!-- Swipeable Content -->
    <div
        class="swipeable-content relative z-10"
        style={contentStyle}
        ontouchstart={handleTouchStart}
        ontouchmove={handleTouchMove}
        ontouchend={handleTouchEnd}
        ontouchcancel={resetSwipe}
    >
        {@render children()}
    </div>
</div>

<style>
    @keyframes slideUpFade {
        from {
            opacity: 0;
            transform: translateY(50px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .swipeable-container {
        touch-action: pan-y;
        animation: slideUpFade 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    
    .swipeable-content {
        will-change: transform;
    }
</style>
