import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Use '.' instead of process.cwd() to avoid type issues with `process` if @types/node is missing
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    define: {
      // This tells the builder: "Wherever you see 'process.env.API_KEY', replace it with this string"
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || ''),
      // Fallback for libraries using process.env
      'process.env': {},
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    }
  }
})