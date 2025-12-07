import { writable } from 'svelte/store';

export type ConfirmOptions = {
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'destructive';
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
};

export type AlertOptions = {
    message: string;
    title?: string;
    onConfirm?: () => void;
};

type ModalState = {
    confirm: ConfirmOptions | null;
    alert: AlertOptions | null;
};

function createModalStore() {
    const { subscribe, update, set } = writable<ModalState>({
        confirm: null,
        alert: null
    });

    return {
        subscribe,
        confirm: (options: ConfirmOptions) => update(s => ({ ...s, confirm: options })),
        alert: (options: AlertOptions) => update(s => ({ ...s, alert: options })),
        closeConfirm: () => update(s => ({ ...s, confirm: null })),
        closeAlert: () => update(s => ({ ...s, alert: null })),
        reset: () => set({ confirm: null, alert: null })
    };
}

export const modals = createModalStore();
