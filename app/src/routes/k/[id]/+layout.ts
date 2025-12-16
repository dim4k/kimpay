import { pb } from "$lib/pocketbase";
import { error } from "@sveltejs/kit";
import type { LayoutLoad } from "./$types";
import { kimpayStore } from "$lib/stores/kimpay.svelte";
import { participantsStore } from "$lib/stores/participants.svelte";
import { expensesStore } from "$lib/stores/expenses.svelte";
import type { Kimpay } from "$lib/types";
import { storageService } from "$lib/services/storage";
import { EXPAND } from "$lib/constants";

export const ssr = false;

export const load: LayoutLoad = async ({ params, fetch }) => {
    try {
        const kimpay = await pb.collection("kimpays").getOne(params.id, {
            expand: EXPAND.KIMPAY_FULL,
            fetch: fetch,
            requestKey: null // Prevent auto-cancellation issues
        });

        // Initialize stores with fetched data
        const participants = kimpay.expand?.participants_via_kimpay || [];
        const expenses = kimpay.expand?.expenses_via_kimpay || [];

        // We can fire and forget these inits since we return data for immediate page load
        // Or await them to ensure stores are sync'd before page components mount
        await Promise.all([
            kimpayStore.init(params.id, kimpay as unknown as Kimpay, true),
            participantsStore.init(params.id, participants, true),
            expensesStore.init(params.id, expenses, true)
        ]);

        return {
            kimpay,
            participants,
        };
    } catch (e: unknown) {
        // Fallback to Cache (Offline Mode)
        const cached = storageService.getKimpayData(params.id);
        if (cached) {
             const participants = cached.expand?.participants_via_kimpay || [];
             const expenses = cached.expand?.expenses_via_kimpay || [];

             // Initialize with cached data
             await Promise.all([
                kimpayStore.init(params.id, cached as unknown as Kimpay),
                participantsStore.init(params.id, participants),
                expensesStore.init(params.id, expenses)
            ]);

             return {
                 kimpay: cached as unknown as import('pocketbase').RecordModel, // Type cast for LayoutLoad return
                 participants,
             };
        }

        if ((e as { status?: number }).status === 404) {
            error(404, "Kimpay not found");
        }
        throw e;
    }
};
