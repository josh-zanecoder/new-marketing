import { fileURLToPath } from 'node:url'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  alias: {
    '@server': fileURLToPath(new URL('./server', import.meta.url))
  },
  srcDir: 'app',
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss', '@nuxt/eslint'],
  runtimeConfig: {
    /** Registry cluster URI; `server/lib/mongoose.ts` reads via `useRuntimeConfig()` first. */
    mongodbUri: process.env.MONGODB_URI || 'mongodb+srv://josh_db_user:ZSQbOPOr8HZa3VdB@cluster0.qphzwve.mongodb.net/',
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
    redisUsername: process.env.REDIS_USERNAME || 'default',
    kafkaBrokers: process.env.KAFKA_BROKERS || '',
    kafkaClientId: process.env.KAFKA_CLIENT_ID || 'new-marketing',
    kafkaTopicEvents: process.env.KAFKA_TOPIC_MARKETING_EVENTS || 'marketing.events',
    kafkaUsername: process.env.KAFKA_USERNAME || '',
    kafkaPassword: process.env.KAFKA_PASSWORD || '',
    kafkaSaClientEmail: process.env.KAFKA_SA_CLIENT_EMAIL || '',
    kafkaSaPrivateKey: process.env.KAFKA_SA_PRIVATE_KEY || '',
    kafkaSaProjectId: process.env.KAFKA_SA_PROJECT_ID || '',
    kafkaSsl: process.env.KAFKA_SSL !== 'false',
    kafkaSaslMechanism: process.env.KAFKA_SASL_MECHANISM || 'plain',
    /**
     * Tenant handoff JWT claims — must match the issuer (CRM / tenant backend).
     * Runtime: `NUXT_MARKETING_HANDOFF_ISS` / `NUXT_MARKETING_HANDOFF_AUD`, or
     * `MARKETING_HANDOFF_JWT_ISS` / `MARKETING_HANDOFF_JWT_AUD` (read at config load).
     */
    marketingHandoffIss:
      process.env.NUXT_MARKETING_HANDOFF_ISS ||
      process.env.MARKETING_HANDOFF_JWT_ISS ||
      'marketing-tenant',
    marketingHandoffAud:
      process.env.NUXT_MARKETING_HANDOFF_AUD ||
      process.env.MARKETING_HANDOFF_JWT_AUD ||
      'new-marketing'
  },
  css: ['grapesjs/dist/css/grapes.min.css'],
  vite: {
    optimizeDeps: {
      include: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'xlsx',
        'grapesjs',
        'grapesjs-preset-newsletter',
        'firebase/app',
        'firebase/auth'
      ]
    }
  },
  routeRules: {
    '/': { redirect: '/tenant/dashboard' }
  },
  nitro: {
    /** Path is relative to `server/` (Nitro prepends `server/` itself). */
    plugins: ['kafka/plugins/kafka-inbound-consumer.ts']
  }
})