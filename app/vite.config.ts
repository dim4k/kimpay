import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";

const file = fileURLToPath(new URL("package.json", import.meta.url));
const json = readFileSync(file, "utf8");
const pkg = JSON.parse(json);

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    
    return {
        plugins: [
            tailwindcss(),
            sveltekit({
                // Consult https://svelte.dev/docs/kit/integrations
                // for more information about preprocessors
                preprocess: vitePreprocess(),
                adapter: adapter({ fallback: "index.html" }),
                // Detect new deployments so the app can reload itself instead of
                // running stale code against a newer backend (see +layout.svelte).
                version: { pollInterval: 5 * 60 * 1000 }
            })
        ],
        define: {
            __APP_VERSION__: JSON.stringify(pkg.version),
            __POCKETBASE_URL__: JSON.stringify(env.PUBLIC_POCKETBASE_URL || ""),
        },
        server: {
            watch: {
                usePolling: true,
            },
            host: true,
        },
    };
});
