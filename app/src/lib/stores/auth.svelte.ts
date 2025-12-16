import { pb } from '$lib/pocketbase';
import type { User } from '$lib/types';

class AuthStore {
    user = $state<User | null>(pb.authStore.model as User | null);
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

    async loginWithToken(token: string): Promise<boolean> {
        pb.authStore.save(token, null);
        try {
            await pb.collection('users').authRefresh();
            return true;
        } catch (e) {
            console.error("Login with token failed", e);
            pb.authStore.clear();
            return false;
        }
    }

    async loginWithOtp(code: string): Promise<boolean> {
        try {
            const response = await pb.send("/api/login/verify", {
                method: "POST",
                body: { code }
            });

            if (response.token && response.user) {
                pb.authStore.save(response.token, response.user);
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
            body: { email, locale }
        });
    }

    async init(): Promise<void> {
        if (!pb.authStore.isValid) return;
        try {
            await pb.collection('users').authRefresh();
        } catch (e: unknown) {
            const err = e as { name: string; status: number };
            
            // Keep session on network error (0) or if we are known to be offline
            if (err.status === 0 || (typeof navigator !== 'undefined' && !navigator.onLine)) {
                console.warn("Auth refresh failed due to network, keeping session.");
                return;
            }
            
            console.warn("Session invalid, logging out:", e);
            pb.authStore.clear();
        }
    }
}

export const auth = new AuthStore();
