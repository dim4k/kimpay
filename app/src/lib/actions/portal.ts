/**
 * Teleports the node to the target element (default: body).
 * Usage: <div use:portal>...</div>
 */
export function portal(node: HTMLElement, target: HTMLElement | string = 'body') {
    let targetEl: Element | null;

    async function update(newTarget: HTMLElement | string) {
        if (typeof newTarget === 'string') {
            targetEl = document.querySelector(newTarget);
        } else if (newTarget instanceof HTMLElement) {
            targetEl = newTarget;
        } else {
            targetEl = document.body;
        }

        if (targetEl) {
            targetEl.appendChild(node);
        }
    }

    update(target);

    return {
        update,
        destroy() {
            if (node.parentNode) {
                node.parentNode.removeChild(node);
            }
        }
    };
}
