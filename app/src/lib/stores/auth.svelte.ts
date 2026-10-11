import { pb } from '$lib/pocketbase';
import type { RecordModel } from 'pocketbase';
import type { User } from '$lib/types';
import { isNetworkError } from '$lib/utils/errors';
import { get } from 'svelte/store';
import { t } from '$lib/i18n';
import { modals } from '$lib/stores/modals.svelte';

class AuthStore {
    user = $state<User | null>(pb.authStore.record as User | null);
    isValid = $state(pb.authStore.isValid);

    constructor() {
        // Sync with PocketBase auth store
        pb.authStore.onChange((_token, model) => {
            this.user = model as User | null;
            this.isValid = pb.authStore.isValid;
        }, true);
    }

    logout() {
        pb.authStore.clear();
    }

    /** Ask for confirmation, then log out and reload the app on the home page. */
    confirmLogout() {
        const translate = get(t);
        modals.confirm({
            title: translate('modal.logout.title'),
            description: translate('modal.logout.desc'),
            confirmText: translate('modal.logout.confirm'),
            variant: 'destructive',
            onConfirm: () => {
                this.logout();
                window.location.href = "/";
            }
        });
    }

    /**
     * Replace the logged-in user record (e.g. after a profile update). Goes
     * through the PocketBase auth store so it stays the single source of truth
     * (and is persisted); `user` is then updated by the onChange listener.
     */
    setUser(user: User) {
        pb.authStore.save(pb.authStore.token, user as unknown as RecordModel);
    }

    async loginWithOtp(code: string): Promise<boolean> {
        try {
            const response = await pb.send("/api/login/verify", {
                method: "POST",
                body: { code }
            });

            if (response.token && response.record) {
                pb.authStore.save(response.token, response.record);
                return true;
            }
            return false;
        } catch (e) {
            console.error("Login with OTP failed", e);
            return false;
        }
    }

    async requestMagicLink(email: string, locale = "en-US"): Promise<void> {
        await pb.send("/api/login/magic-link", {
            method: "POST",
            body: { 
                email, 
                locale,
                url: window.location.origin 
            }
        });
    }
    
    async register(email: string, name: string, participantId?: string, locale = "en"): Promise<void> {
        await pb.send("/api/register", {
            method: "POST",
            body: { 
                email, 
                name,
                participantId,
                locale,
                url: window.location.origin 
            }
        });
    }

    async init(): Promise<void> {
        if (!pb.authStore.isValid) return;
        try {
            await pb.collection('users').authRefresh();
        } catch (e: unknown) {
            // Keep session on network error or if we are known to be offline
            if (isNetworkError(e)) {
                console.warn("Auth refresh failed due to network, keeping session.");
                return;
            }
            
            console.warn("Session invalid, logging out:", e);
            pb.authStore.clear();
        }
    }
}

export const auth = new AuthStore();
