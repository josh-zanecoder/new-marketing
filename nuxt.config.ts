// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  srcDir: 'app',
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss'],
  runtimeConfig: {
    mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/mortdash-registry',
    brevoApiKey: process.env.BREVO_API_KEY || ''
  },
  css: ['grapesjs/dist/css/grapes.min.css'],
  vite: {
    optimizeDeps: {
      include: ['@vue/devtools-core', '@vue/devtools-kit', 'xlsx', 'grapesjs', 'grapesjs-preset-newsletter']
    }
  },
  routeRules: {
    '/': { redirect: '/client/dashboard' }
  }
})