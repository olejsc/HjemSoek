import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// Set base path for GitHub Pages (repo name). In local dev (vite), base isn't used.
const base = process.env.GITHUB_ACTIONS ? '/HjemSoek/' : '/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
})
