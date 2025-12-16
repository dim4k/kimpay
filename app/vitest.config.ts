import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
    plugins: [sveltekit()],
    test: {
        // Only include unit tests
        include: ['tests/unit/**/*.test.ts', 'src/**/*.test.ts'],
        // Exclude E2E tests
        exclude: ['tests/e2e/**', 'node_modules/**'],
        environment: 'node'
    }
});
