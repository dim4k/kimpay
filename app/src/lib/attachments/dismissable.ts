import type { Attachment } from 'svelte/attachments';

/**
 * Closes a popover (menu, picker...) when the user presses Escape or
 * interacts outside of the element it is attached to. Attach it to the
 * element wrapping both the trigger and the popover, only while open:
 *
 *   <div {@attach isOpen && dismissable(() => (isOpen = false))}>
 */
export function dismissable(onDismiss: () => void): Attachment<HTMLElement> {
    return (node) => {
        const onPointerDown = (event: PointerEvent) => {
            if (!node.contains(event.target as Node)) onDismiss();
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onDismiss();
        };
        // Capture phase: runs even if a handler below stops propagation.
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown, true);
            document.removeEventListener('keydown', onKeyDown);
        };
    };
}
