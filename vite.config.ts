/**
 * [ПОДСКАЗКА] Vite-конфиг для React + Tailwind.
 * - Не требуется для HTML-превью. Используется для dev/build.
 */
import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  define: {
    'import.meta.env.VITE_TG_BOT_USERNAME': JSON.stringify(process.env.VITE_TG_BOT_USERNAME || 'F1tA1Bot'),
  },
})


