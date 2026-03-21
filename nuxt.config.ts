// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  srcDir: 'app',
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss', '@nuxt/eslint'],
  runtimeConfig: {
    /** Registry cluster URI; `server/utils/db.ts` reads via `useRuntimeConfig()` first. */
    mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/mortdash-registry',
    /** Default DB name on that cluster (e.g. `marketing`). */
    mongodbDbName: process.env.MONGODB_DB_NAME || 'marketing',
    brevoApiKey: process.env.BREVO_API_KEY || '',
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
    firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY || '',
    public: {
      firebaseApiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY || '',
      firebaseAuthDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
      firebaseProjectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID || '',
      firebaseAppId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID || ''
    },
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