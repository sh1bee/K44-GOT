// vite.config.js
import { defineConfig } from 'vite'
import glsl from 'vite-plugin-glsl'

export default defineConfig({
  base: '/K44-GOT/', 
  plugins: [glsl()]
})