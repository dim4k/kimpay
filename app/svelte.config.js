import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
    // Consult https://svelte.dev/docs/kit/integrations
    // for more information about preprocessors
    preprocess: vitePreprocess(),

    kit: {
        adapter: adapter({
            fallback: "index.html",
        }),
        // Detect new deployments so the app can reload itself instead of
        // running stale code against a newer backend (see +layout.svelte).
        version: {
            pollInterval: 5 * 60 * 1000,
        },
    },
};

export default config;
