import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		proxy: {
			// API Gateway for main application APIs
			'/api/v1': {
				target: 'http://localhost:8080',
				changeOrigin: true,
				secure: false,
			},
		},
	},
});


