/* eslint-disable @typescript-eslint/no-explicit-any */
import { writable } from 'svelte/store';

export const installPrompt = writable<unknown>(null);

export async function install() {
    let promptEvent: any;
    
    // Subscribe once to get the current value
    const unsubscribe = installPrompt.subscribe(value => {
        promptEvent = value;
    });
    unsubscribe();

    if (!promptEvent) return;

    // Show the install prompt
    promptEvent.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await promptEvent.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);

    // We've used the prompt, and can't use it again, clear store
    installPrompt.set(null);
}
