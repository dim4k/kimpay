import { writable } from 'svelte/store';

export interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    duration?: number;
}

function createToastStore() {
    const { subscribe, update } = writable<Toast[]>([]);

    function add(message: string, type: Toast['type'] = 'info', duration = 3000) {
        const id = crypto.randomUUID();
        const toast: Toast = { id, message, type, duration };
        
        update(toasts => [...toasts, toast]);
        
        if (duration > 0) {
            setTimeout(() => remove(id), duration);
        }
        
        return id;
    }

    function remove(id: string) {
        update(toasts => toasts.filter(t => t.id !== id));
    }

    function success(message: string, duration?: number) {
        return add(message, 'success', duration);
    }

    function error(message: string, duration?: number) {
        return add(message, 'error', duration);
    }

    function info(message: string, duration?: number) {
        return add(message, 'info', duration);
    }

    function warning(message: string, duration?: number) {
        return add(message, 'warning', duration);
    }

    return {
        subscribe,
        add,
        remove,
        success,
        error,
        info,
        warning
    };
}

export const toasts = createToastStore();
