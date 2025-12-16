import type { Participant } from "$lib/types";

export type ConfirmOptions = {
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "default" | "destructive";
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
};

export type AlertOptions = {
    message: string;
    title?: string;
    variant?: 'error' | 'info';
    onConfirm?: () => void;
};

export type GalleryOptions = {
    photos: string[];
    record: { id: string; collectionId: string; collectionName: string };
};

export type IdentityOptions = {
    kimpayId: string;
    participants?: Participant[];
    onSelect?: () => void;
};

class ModalStore {
    confirmState = $state<ConfirmOptions | null>(null);
    alertState = $state<AlertOptions | null>(null);
    galleryState = $state<GalleryOptions | null>(null);
    identityState = $state<IdentityOptions | null>(null);

    confirm(options: ConfirmOptions) {
        this.confirmState = options;
    }
    alert(options: AlertOptions) {
        this.alertState = options;
    }
    gallery(options: GalleryOptions) {
        this.galleryState = options;
    }
    identity(options: IdentityOptions) {
        this.identityState = options;
    }

    close() {
        this.confirmState = null;
        this.alertState = null;
        this.galleryState = null;
        this.identityState = null;
    }
    closeConfirm() {
        this.confirmState = null;
    }
    closeAlert() {
        this.alertState = null;
    }
    closeGallery() {
        this.galleryState = null;
    }
    closeIdentity() {
        this.identityState = null;
    }

    registerState = $state<{ participantId?: string } | null>(null);
    register(options: { participantId?: string }) {
        this.registerState = options;
    }
    closeRegister() {
        this.registerState = null;
    }
}

export const modals = new ModalStore();
