import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		proxy: {
			// OPC UA API through API Gateway proxy
			'/opcua-direct': {
				target: 'http://localhost:8080',
				changeOrigin: true,
				secure: false,
				rewrite: (path) => path.replace(/^\/opcua-direct/, '/api/v1/opcua-direct'),
			},
			// API Gateway for main application APIs
			'/api/v1': {
				target: 'http://localhost:8080',
				changeOrigin: true,
				secure: false,
			},
			// Legacy connections endpoint (compatibility)
			'/connections': {
				target: 'http://localhost:8080',
				changeOrigin: true,
				secure: false,
				rewrite: (path) => path.replace(/^\/connections/, '/api/v1/opcua-direct/connections'),
			},
		},
	},
});


