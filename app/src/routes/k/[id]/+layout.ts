/* eslint-disable @typescript-eslint/no-explicit-any */
import { pb } from '$lib/pocketbase';
import { error } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const ssr = false;

export const load: LayoutLoad = async ({ params, fetch }) => {
    try {
        const kimpay = await pb.collection('kimpays').getOne(params.id, {
            expand: 'participants_via_kimpay',
            fetch: fetch
        });

        // Set requestKey: null to prevent auto cancellation for simple reads if desired, but default is fine here.
        return {
            kimpay,
            participants: kimpay.expand?.participants_via_kimpay || []
        };
    } catch (e: any) {
        if (e.status === 404) {
            error(404, 'Kimpay not found');
        }
        throw e;
    }
};
