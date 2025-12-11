import { pb } from "$lib/pocketbase";
import { error } from "@sveltejs/kit";
import type { LayoutLoad } from "./$types";
import { appState } from "$lib/stores/appState.svelte";
import type { Kimpay } from "$lib/types";
import { storageService } from "$lib/services/storage";

export const ssr = false;

export const load: LayoutLoad = async ({ params, fetch }) => {
    try {
        const kimpay = await pb.collection("kimpays").getOne(params.id, {
            expand: "participants_via_kimpay,expenses_via_kimpay.payer,expenses_via_kimpay.involved",
            fetch: fetch,
            requestKey: null // Prevent auto-cancellation issues
        });

        // Initialize app state with fetched data
        await appState.init(params.id, false, kimpay as unknown as Kimpay);

        return {
            kimpay,
            participants: kimpay.expand?.participants_via_kimpay || [],
        };
    } catch (e: unknown) {
        // Fallback to Cache (Offline Mode)
        const cached = storageService.getKimpayData(params.id);
        if (cached) {
             // Initialize with cached data
             await appState.init(params.id, false, cached);
             return {
                 kimpay: cached as unknown as import('pocketbase').RecordModel, // Type cast for LayoutLoad return
                 participants: cached.expand?.participants_via_kimpay || [],
             };
        }

        if ((e as { status?: number }).status === 404) {
            error(404, "Kimpay not found");
        }
        throw e;
    }
};
