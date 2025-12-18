import type { Kimpay, Participant } from "$lib/types";

class ActiveKimpayGlobal {
    kimpay = $state<Kimpay | null>(null);
    myParticipant = $state<Participant | null>(null);

    set(kimpay: Kimpay | null, myParticipant: Participant | null) {
        this.kimpay = kimpay;
        this.myParticipant = myParticipant;
    }

    reset() {
        this.kimpay = null;
        this.myParticipant = null;
    }
}

export const activeKimpayGlobal = new ActiveKimpayGlobal();
