import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		watch: {
			usePolling: true
		},
		host: true // Ensure it listens on all interfaces (0.0.0.0) which is needed for Docker
	}
});
