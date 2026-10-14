import { writable } from 'svelte/store';

export interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    duration?: number;
}

/** At most this many on screen: the oldest goes first. */
const MAX_TOASTS = 3;

function createToastStore() {
    const { subscribe, update } = writable<Toast[]>([]);

    // Time left before each toast goes; paused while hovered or focused.
    // Bookkeeping only (never rendered), hence a plain Map.
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const timers = new Map<string, { left: number; started: number; handle?: ReturnType<typeof setTimeout> | undefined }>();

    function schedule(id: string, ms: number) {
        timers.set(id, { left: ms, started: Date.now(), handle: setTimeout(() => remove(id), ms) });
    }

    function add(message: string, type: Toast['type'] = 'info', duration = 4000) {
        const id = crypto.randomUUID();
        const toast: Toast = { id, message, type, duration };

        update(toasts => {
            const next = [...toasts, toast];
            for (const gone of next.slice(0, -MAX_TOASTS)) forget(gone.id);
            return next.slice(-MAX_TOASTS);
        });

        if (duration > 0) schedule(id, duration);

        return id;
    }

    function forget(id: string) {
        const timer = timers.get(id);
        if (timer?.handle) clearTimeout(timer.handle);
        timers.delete(id);
    }

    function remove(id: string) {
        forget(id);
        update(toasts => toasts.filter(t => t.id !== id));
    }

    /** Hovered or focused: the toast stays until left. */
    function pause(id: string) {
        const timer = timers.get(id);
        if (!timer?.handle) return;
        clearTimeout(timer.handle);
        timer.left -= Date.now() - timer.started;
        timer.handle = undefined;
    }

    /** Left: what remained of its time, at least long enough to be read again. */
    function resume(id: string) {
        const timer = timers.get(id);
        if (!timer || timer.handle) return;
        timer.started = Date.now();
        timer.handle = setTimeout(() => remove(id), Math.max(timer.left, 1500));
    }

    function success(message: string, duration?: number) {
        return add(message, 'success', duration);
    }

    function error(message: string, duration = 8000) {
        return add(message, 'error', duration);
    }

    function warning(message: string, duration = 6000) {
        return add(message, 'warning', duration);
    }

    function info(message: string, duration?: number) {
        return add(message, 'info', duration);
    }

    return {
        subscribe,
        add,
        remove,
        pause,
        resume,
        success,
        error,
        warning,
        info
    };
}

export const toasts = createToastStore();
