import { pb } from "$lib/pocketbase";
import { error } from "@sveltejs/kit";
import type { LayoutLoad } from "./$types";
import { appState } from "$lib/stores/appState.svelte";
import type { Kimpay } from "$lib/types";

export const ssr = false;

export const load: LayoutLoad = async ({ params, fetch }) => {
    try {
        const kimpay = await pb.collection("kimpays").getOne(params.id, {
            expand: "participants_via_kimpay,expenses_via_kimpay.payer,expenses_via_kimpay.involved",
            fetch: fetch,
        });

        // Initialize app state with fetched data
        await appState.init(params.id, false, kimpay as unknown as Kimpay);

        // Set requestKey: null to prevent auto cancellation for simple reads if desired, but default is fine here.
        return {
            kimpay,
            participants: kimpay.expand?.participants_via_kimpay || [],
        };
    } catch (e: unknown) {
        if ((e as { status?: number }).status === 404) {
            error(404, "Kimpay not found");
        }
        throw e;
    }
};
