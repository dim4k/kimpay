import PocketBase from "pocketbase";
import { env } from "$env/dynamic/public";

const url = env.PUBLIC_POCKETBASE_URL || "http://localhost:8090";

export const pb = new PocketBase(url);

export const currentUser = pb.authStore.model;
