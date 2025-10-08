import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
	plugins: [
		sveltekit(),
		visualizer({
			open: false,
			filename: 'bundle-analysis.html',
			gzipSize: true,
			brotliSize: true
		})
	]
});
