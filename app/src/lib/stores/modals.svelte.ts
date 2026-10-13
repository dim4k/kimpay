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
    variant?: 'error' | 'info' | 'success';
    onConfirm?: () => void;
};

export type GalleryOptions = {
    photos: string[];
    record: { id: string; collectionId: string; collectionName: string };
    /** Index of the photo shown first */
    start?: number;
};

export type RegisterOptions = {
    participantId?: string;
    /** Why an account is asked for (e.g. to scan receipts) */
    description?: string;
};

export type IdentityOptions = {
    kimpayId: string;
    /** The member a personal invite link was made for ("Are you Coralie?") */
    suggestedId?: string;
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

    registerState = $state<RegisterOptions | null>(null);
    register(options: RegisterOptions) {
        this.registerState = options;
    }
    closeRegister() {
        this.registerState = null;
    }
}

export const modals = new ModalStore();
