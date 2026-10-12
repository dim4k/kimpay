import { pb } from '#lib/pocketbase.js';
import type { User } from '#lib/types.js';

export const userService = {
    /**
     * Update user preferences (currency, name, etc.)
     */
    async updatePreferences(
        userId: string,
        preferences: { currency?: string; name?: string }
    ): Promise<User> {
        const data: Record<string, string> = {};
        if (preferences.currency) data.preferred_currency = preferences.currency;
        if (preferences.name) data.name = preferences.name;

        return await pb.collection('users').update<User>(userId, data);
    },

    /** Save the profile's payment handles ("" clears one). */
    async updatePaymentHandles(userId: string, handles: { paypal: string; revolut: string }): Promise<User> {
        return await pb.collection('users').update<User>(userId, handles);
    },

    /**
     * Update user avatar
     */
    async updateAvatar(userId: string, file: File): Promise<User> {
        await pb.collection('users').update(userId, { avatar: file });
        // Refetch to get the new filename
        return await pb.collection('users').getOne<User>(userId);
    },

    /**
     * Remove user avatar
     */
    async removeAvatar(userId: string): Promise<User> {
        return await pb.collection('users').update<User>(userId, { avatar: null });
    },
};
