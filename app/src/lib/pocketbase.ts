import PocketBase from "pocketbase";

declare const __POCKETBASE_URL__: string | undefined;

const url = (typeof __POCKETBASE_URL__ !== "undefined" ? __POCKETBASE_URL__ : null) 
    || "http://localhost:8090";

export const pb = new PocketBase(url);

export const currentUser = pb.authStore.model;
