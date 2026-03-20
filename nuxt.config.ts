// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  srcDir: 'app',
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss', '@nuxt/eslint'],
  runtimeConfig: {
    mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/mortdash-registry',
    brevoApiKey: process.env.BREVO_API_KEY || '',
    redisHost: process.env.REDIS_HOST || '127.0.0.1',
    redisPort: Number(process.env.REDIS_PORT) || 6379,
    redisPassword: (process.env.REDIS_PASSWORD || '').trim(),
    redisDb: Number(process.env.REDIS_DB) || 0,
    redisUsername: process.env.REDIS_USERNAME || 'default'
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