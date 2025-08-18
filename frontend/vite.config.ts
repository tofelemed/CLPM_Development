import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		proxy: {
			// OPC UA service 1 (e.g., connections, security-options)
			'/opcua': {
				target: 'http://localhost:3001',
				changeOrigin: true,
				secure: false,
				rewrite: (path) => path.replace(/^\/opcua/, ''),
			},
			// Optional second OPC UA service if used elsewhere
			'/opcua2': {
				target: 'http://localhost:3002',
				changeOrigin: true,
				secure: false,
				rewrite: (path) => path.replace(/^\/opcua2/, ''),
			},
			// Direct OPC UA client API (e.g., 4842) used by tag browser and loop config
			'/opcua-direct': {
				target: 'http://localhost:4842',
				changeOrigin: true,
				secure: false,
				rewrite: (path) => path.replace(/^\/opcua-direct/, ''),
			},
			// API Gateway passthrough if needed
			'/opcua-gateway': {
				target: 'http://localhost:8080',
				changeOrigin: true,
				secure: false,
				rewrite: (path) => path.replace(/^\/opcua-gateway/, '/api/v1/loops/opcua'),
			},
		},
	},
});


