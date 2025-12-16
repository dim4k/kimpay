import { pb } from '$lib/pocketbase';
import { auth } from '$lib/stores/auth.svelte';
import type { Participant } from '$lib/types';

class MyKimpaysStore {
    items = $state<Participant[]>([]);
    isLoading = $state(false);
    initialized = $state(false);

    async load(force = false) {
        if (!auth.user) {
            this.items = [];
            return;
        }

        // If we already have data and not forcing, just return (or background refresh)
        if (this.initialized && !force && this.items.length > 0) {
            return;
        }

        if (this.items.length === 0) {
            this.isLoading = true;
        }

        try {
            const records = await pb.collection('participants').getList<Participant>(1, 100, {
                filter: `user = "${auth.user.id}"`,
                sort: '-created',
                expand: 'kimpay'
            });
            this.items = records.items;
            this.initialized = true;
        } catch (e) {
            console.error("Failed to load kimpays", e);
        } finally {
            this.isLoading = false;
        }
    }

    reset() {
        this.items = [];
        this.isLoading = false;
        this.initialized = false;
    }
}

export const myKimpays = new MyKimpaysStore();
