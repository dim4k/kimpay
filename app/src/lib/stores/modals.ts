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

export type GalleryOptions = {
    photos: string[];
    record: any;
};

type ModalState = {
    confirm: ConfirmOptions | null;
    alert: AlertOptions | null;
    gallery: GalleryOptions | null;
};

function createModalStore() {
    const { subscribe, update, set } = writable<ModalState>({
        confirm: null,
        alert: null,
        gallery: null
    });

    return {
        subscribe,
        confirm: (options: ConfirmOptions) => update(s => ({ ...s, confirm: options })),
        alert: (options: AlertOptions) => update(s => ({ ...s, alert: options })),
        gallery: (options: GalleryOptions) => update(s => ({ ...s, gallery: options })),
        closeConfirm: () => update(s => ({ ...s, confirm: null })),
        closeAlert: () => update(s => ({ ...s, alert: null })),
        closeGallery: () => update(s => ({ ...s, gallery: null })),
        reset: () => set({ confirm: null, alert: null, gallery: null })
    };
}

export const modals = createModalStore();
