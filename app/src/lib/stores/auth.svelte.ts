import { pb } from '$lib/pocketbase';

export interface User {
    id: string;
    username: string;
    email: string;
    name: string;
    avatar?: string;
    created: string;
    updated: string;
}

function createAuthStore() {
    let user = $state<User | null>(pb.authStore.model as User | null);
    let isValid = $state(pb.authStore.isValid);

    // Sync with PocketBase auth store
    pb.authStore.onChange((token, model) => {
        user = model as User | null;
        isValid = pb.authStore.isValid;
    }, true);

    return {
        get user() { return user; },
        get isValid() { return isValid; },
        
        logout() {
            pb.authStore.clear();
        },

        async loginWithToken(token: string) {
            pb.authStore.save(token, null); // Save token temporarily
            try {
                // Refresh to get the user model and validate token
                await pb.collection('users').authRefresh(); 
                return true;
            } catch (e) {
                console.error("Login with token failed", e);
                pb.authStore.clear();
                return false;
            }
        },

        async loginWithOtp(code: string) {
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
        },

        async requestMagicLink(email: string, locale = "en-US") {
            await pb.send("/api/login/magic-link", {
                method: "POST",
                body: {
                    email,
                    locale
                }
            });
        },

        async init() {
            if (!pb.authStore.isValid) return;
            try {
                await pb.collection('users').authRefresh();
            } catch (e: unknown) {
                // If the request was auto-cancelled or failed due to network, it doesn't mean the session is invalid.
                const err = e as { name: string, status: number };
                
                // Keep session on network error (0) or if we are known to be offline
                if (err.status === 0 || (typeof navigator !== 'undefined' && !navigator.onLine)) {
                     console.warn("Auth refresh failed due to network, keeping session.");
                     return;
                }
                
                console.warn("Session invalid, logging out:", e);
                // Clear store if refresh failed (e.g. user deleted on server)
                pb.authStore.clear();
            }
        }
    };
}

export const auth = createAuthStore();
