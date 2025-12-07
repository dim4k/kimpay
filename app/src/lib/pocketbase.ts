import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/public';
import { browser } from '$app/environment';

// If in browser, use localhost (or window.location if deployed). 
// If on server (docker), use internal hostname.
const url = env.PUBLIC_POCKETBASE_URL || (browser 
    ? (window.location.origin.includes('localhost') ? "http://localhost:8090" : "/") 
    : "http://pocketbase:8090");

export const pb = new PocketBase(url);

export const currentUser = pb.authStore.model;
