import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, loadEnv } from "vite";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";

const file = fileURLToPath(new URL("package.json", import.meta.url));
const json = readFileSync(file, "utf8");
const pkg = JSON.parse(json);

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    
    return {
        plugins: [sveltekit()],
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
