import { fileURLToPath } from 'node:url'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  alias: {
    '@server': fileURLToPath(new URL('./server', import.meta.url))
  },
  srcDir: 'app',
  devServer: {
    host: process.env.NUXT_HOST || '0.0.0.0',
    port: Number(process.env.NUXT_PORT) || 3001
  },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss', '@nuxt/eslint'],
  tailwindcss: {
    cssPath: '~/assets/css/main.css',
    configPath: 'tailwind.config.ts',
  },
  runtimeConfig: {
    /** Registry cluster URI; `server/lib/mongoose.ts` reads via `useRuntimeConfig()` first. */
    mongodbUri: process.env.MONGODB_URI || '',
    /** Default DB name on that cluster (e.g. `marketing`). */
    mongodbDbName: process.env.MONGODB_DB_NAME || 'marketing',
    brevoApiKey: process.env.BREVO_API_KEY || '',
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
    firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY || '',
    /** GCS bucket for Custom Marketing email images (public HTTPS URLs for Gmail). */
    gcsBucket: process.env.GCS_BUCKET || process.env.MARKETING_GCS_BUCKET || '',
    gcsProjectId:
      process.env.GCS_PROJECT_ID || process.env.CLOUD_TASKS_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '',
    gcsClientEmail: process.env.GCS_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL || '',
    /** PEM private key, or set `GCS_PRIVATE_KEY_BASE64` instead. */
    gcsPrivateKey: process.env.GCS_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY || '',
    gcsPrivateKeyBase64: process.env.GCS_PRIVATE_KEY_BASE64 || '',
    public: {
      marketingBaseUrl:
        process.env.NUXT_PUBLIC_MARKETING_BASE_URL || process.env.MARKETING_PUBLIC_BASE_URL || '',
      firebaseApiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY || '',
      firebaseAuthDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
      firebaseProjectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID || '',
      firebaseAppId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID || '',
      /** Google Places Autocomplete (New); enable Places API (New) + Maps JavaScript API on the key. */
      googleMapsApiKey:
        process.env.NUXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || ''
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
      'new-marketing',
    /** Public Marketing app URL shown in CRM external connection metadata. */
    marketingAppUrl:
      process.env.NUXT_MARKETING_APP_URL ||
      process.env.MARKETING_APP_URL ||
      '',
    /** Kafka producer bridge URL for CRM bridge mode. */
    kafkaBridgeUrl:
      process.env.NUXT_KAFKA_BRIDGE_URL ||
      process.env.KAFKA_BRIDGE_URL ||
      '',
    /** Shared secret for CRM → bridge publishes (same value as bridge BRIDGE_TOKEN). */
    kafkaBridgeToken:
      process.env.NUXT_KAFKA_BRIDGE_TOKEN ||
      process.env.KAFKA_BRIDGE_TOKEN ||
      '',
    /**
     * Deployment target for CRM integration defaults when URLs are unset:
     * `develop` (test) or `production`.
     */
    marketingDeployEnv:
      process.env.NUXT_MARKETING_DEPLOY_ENV ||
      process.env.MARKETING_DEPLOY_ENV ||
      'develop'
  },
  css: [
    'grapesjs/dist/css/grapes.min.css',
    '@vuepic/vue-datepicker/dist/main.css',
    '~/assets/css/google-places.css'
  ],
  vite: {
    optimizeDeps: {
      include: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'xlsx',
        'grapesjs',
        'grapesjs-preset-newsletter',
        'firebase/app',
        'firebase/auth',
        'echarts/core',
        'vue-echarts'
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