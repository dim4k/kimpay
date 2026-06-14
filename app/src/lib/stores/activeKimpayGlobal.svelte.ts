import type { Kimpay, Participant } from "$lib/types";
import type { ActiveKimpay } from "$lib/stores/activeKimpay.svelte";

/**
 * Bridges the route-scoped `ActiveKimpay` instance (created in
 * `/k/[id]/+layout.svelte`) to the root-layout navbar (`SiteHeader`), which
 * lives outside the Kimpay route context.
 *
 * Instead of mirroring state manually, it holds a reference to the active
 * instance and derives `kimpay`/`myParticipant` from its live reactive state.
 */
class ActiveKimpayGlobal {
    instance = $state<ActiveKimpay | null>(null);

    get kimpay(): Kimpay | null {
        return this.instance?.kimpay ?? null;
    }

    get myParticipant(): Participant | null {
        const inst = this.instance;
        if (!inst) return null;
        return (
            inst.participants.find((p) => p.id === inst.myParticipantId) ?? null
        );
    }

    setInstance(instance: ActiveKimpay | null) {
        this.instance = instance;
    }

    reset() {
        this.instance = null;
    }
}

export const activeKimpayGlobal = new ActiveKimpayGlobal();
