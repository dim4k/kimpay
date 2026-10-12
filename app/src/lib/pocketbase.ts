import PocketBase from "pocketbase";

declare const __POCKETBASE_URL__: string | undefined;

const url =
    (typeof __POCKETBASE_URL__ !== "undefined" ? __POCKETBASE_URL__ : null) ||
    "http://localhost:8090";

export const pb = new PocketBase(url);

// Who this device is in the open group: sent with every request, so the
// group's history says who made each change (the server checks it belongs
// to the group concerned, and ignores it otherwise).
let actor: string | null = null;

export function setRequestActor(participantId: string | null): void {
    actor = participantId;
}

pb.beforeSend = (url, options) => {
    if (actor) options.headers = { ...options.headers, "X-Kimpay-Participant": actor };
    return { url, options };
};
