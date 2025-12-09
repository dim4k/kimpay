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
    record: Record<string, unknown>;
};

import type { Participant } from '$lib/types';

export type IdentityOptions = {
    // Identity modal works by mostly handling itself via kimpayContext/params but we might want to pass props if needed.
    // For now, it mostly needs to know context or just be triggered.
    // Actually, it needs to access the kimpayId to list participants.
    // If we call it globally, we should pass kimpayId.
    kimpayId: string;
    participants?: Participant[];
    onSelect?: () => void;
};

type ModalState = {
    confirm: ConfirmOptions | null;
    alert: AlertOptions | null;
    gallery: GalleryOptions | null;
    identity: IdentityOptions | null;
};

function createModalStore() {
    const { subscribe, update, set } = writable<ModalState>({
        confirm: null,
        alert: null,
        gallery: null,
        identity: null
    });

    return {
        subscribe,
        confirm: (options: ConfirmOptions) => update(s => ({ ...s, confirm: options })),
        alert: (options: AlertOptions) => update(s => ({ ...s, alert: options })),
        gallery: (options: GalleryOptions) => update(s => ({ ...s, gallery: options })),
        closeConfirm: () => update(s => ({ ...s, confirm: null })),
        closeAlert: () => update(s => ({ ...s, alert: null })),
        closeGallery: () => update(s => ({ ...s, gallery: null })),
        identity: (options: IdentityOptions) => update(s => ({ ...s, identity: options })),
        closeIdentity: () => update(s => ({ ...s, identity: null })),
        reset: () => set({ confirm: null, alert: null, gallery: null, identity: null })
    };
}

export const modals = createModalStore();
