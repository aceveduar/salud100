import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
export default defineConfig({ resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } }, plugins: [react(), tailwindcss(), VitePWA({ registerType: 'prompt', includeAssets: ['icon.svg','apple-touch-icon.png'], manifest: { name: 'Salud100 · Mi registro de salud', short_name: 'Salud100', description: 'Tu salud, a tu ritmo', theme_color: '#16796c', background_color: '#f6f8f7', display: 'standalone', lang: 'es', start_url: '/', icons: [{src:'/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'},{src:'/icon-maskable.png',sizes:'512x512',type:'image/png',purpose:'maskable'}] }, workbox: { globPatterns: ['**/*.{js,css,html,png,svg,woff2}'], navigateFallback: '/index.html' } })] })
