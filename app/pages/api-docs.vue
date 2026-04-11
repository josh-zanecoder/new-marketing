<script setup lang="ts">
definePageMeta({
  layout: false
})

useHead({
  title: 'Tenant integration — Kafka & handoff',
  meta: [
    {
      name: 'description',
      content: 'Kafka integration, config keys, and handoff JWT auth for Marketing tenants.'
    }
  ]
})

type DocsTab = 'overview' | 'setup' | 'sending' | 'auth'

const activeTab = ref<DocsTab>('overview')

const tabs: { id: DocsTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'setup', label: 'Set up' },
  { id: 'sending', label: 'Sending events' },
  { id: 'auth', label: 'Auth' }
]

/** Connection / producer keys (metadata or env). Tenant id, DB name, and topic are separate — see Set up tab. */
const kafkaConnectionEnvKeys = `KAFKA_BROKERS
KAFKA_SSL
KAFKA_USERNAME
KAFKA_PASSWORD
KAFKA_CLIENT_ID
KAFKA_SASL_MECHANISM`

/**
 * retail-origination: `MARKETING_*` in `.env` → `nuxt.config` runtime config (server-only).
 * Tenant-specific values (`MARKETING_DB_NAME`, `MARKETING_TENANT_ID`, `MARKETING_API_KEY`,
 * `MARKETING_KAFKA_TOPIC_MARKETING_EVENTS`) are omitted here — use the Marketing admin values from **Tenant config** above.
 */
const retailMarketingEnvKeys = `MARKETING_BASE_URL
MARKETING_HANDOFF_JWT_ISS
MARKETING_HANDOFF_JWT_AUD
MARKETING_KAFKA_BROKERS
MARKETING_KAFKA_CLIENT_ID
MARKETING_KAFKA_SSL
MARKETING_KAFKA_USERNAME
MARKETING_KAFKA_PASSWORD
MARKETING_KAFKA_SASL_MECHANISM`

/** Sample decoded JWT payload (iss/aud are fixed protocol constants for this server). */
const jwtPayloadRequiredExample = `{
  "iss": "marketing-tenant",
  "aud": "new-marketing",
  "sub": "9293be5e-ffe4-44a1-a724-1596be97c750",
  "iat": 1710000000,
  "exp": 1710000300,
  "k": "nmk_your_tenant_key"
}`

/** Sample optional claims (omit ownerEmails when using tenantWideContacts). */
const jwtPayloadOptionalExample = `{
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+15551234567",
  "role": "Loan Officer",
  "ownerEmails": ["user@example.com", "teammate@example.com"]
}`

const handoffRequestExample = `{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}`

const handoffResponseExample = `{
  "ok": true,
  "tenantName": "Acme Corp"
}`

const crmEventTypes = `contact.created
contact.updated
contact.deleted
marketing.email_template.created
marketing.email_template.updated
marketing.email_template.deleted
marketing.sync.requested`

const crmEnvelopeExample = `{
  "eventType": "contact.created",
  "occurredAt": "2026-04-10T17:31:00.000Z",
  "dBname": "marketing_acme",
  "tenantId": "9293be5e-ffe4-44a1-a724-1596be97c750",
  "payload": {
    "externalId": "contact_123",
    "tenantId": "9293be5e-ffe4-44a1-a724-1596be97c750",
    "dBname": "marketing_acme",
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com",
    "company": "Acme Corp",
    "contactType": "prospect",
    "channel": "retail"
  }
}`

/** Where producers send inbound platform events (CRM reference + typical custom integrations). */
const whereToSendKafka = `Cluster:  KAFKA_BROKERS          (comma-separated host:port; same cluster Marketing consumes)
Topic:    KAFKA_TOPIC_MARKETING_EVENTS   (default: marketing.events)
Key:      Marketing TENANT_ID            (UUID string from tenant config)
Value:    JSON envelope                  (single object, UTF-8 string body — not double-encoded)`

/** marketing.sync.requested — first chunk (chunkIndex 1); later chunks omit ownerEmails / requestedBy*. */
const syncRequestedExample = `{
  "eventType": "marketing.sync.requested",
  "occurredAt": "2026-04-10T17:31:00.000Z",
  "dBname": "marketing_acme",
  "tenantId": "9293be5e-ffe4-44a1-a724-1596be97c750",
  "payload": {
    "tenantId": "9293be5e-ffe4-44a1-a724-1596be97c750",
    "dBname": "marketing_acme",
    "syncType": "login_reconcile",
    "syncId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "chunkIndex": 1,
    "chunkCount": 3,
    "tenantWideContacts": false,
    "ownerEmails": ["user@example.com"],
    "requestedByUserId": "crm-user-id",
    "requestedByEmail": "user@example.com",
    "contacts": [
      {
        "externalId": "contact_1",
        "tenantId": "9293be5e-ffe4-44a1-a724-1596be97c750",
        "dBname": "marketing_acme",
        "firstName": "Jane",
        "lastName": "Doe",
        "email": "jane@example.com",
        "company": "Acme",
        "contactType": "prospect",
        "channel": "retail"
      }
    ]
  }
}`
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-800">
    <header
      class="border-b border-slate-200/80 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70"
    >
      <div class="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div>
          <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Marketing</p>
          <h1 class="text-lg font-semibold text-slate-900">Tenant integration guide</h1>
        </div>
        <NuxtLink
          to="/auth/login"
          class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Sign in
        </NuxtLink>
      </div>
    </header>

    <div class="mx-auto max-w-3xl border-b border-slate-200/80 bg-white px-4 sm:px-6">
      <nav class="flex flex-wrap gap-1" role="tablist" aria-label="Documentation sections">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          role="tab"
          :aria-selected="activeTab === t.id"
          :class="[
            'relative -mb-px border-b-2 px-3 py-3 text-sm font-medium transition-colors',
            activeTab === t.id
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-700'
          ]"
          @click="activeTab = t.id"
        >
          {{ t.label }}
        </button>
      </nav>
    </div>

    <main class="mx-auto max-w-3xl px-4 py-10 sm:px-6 text-sm text-slate-700 leading-relaxed">
      <!-- Overview -->
      <div v-show="activeTab === 'overview'" role="tabpanel" aria-label="Overview">
        <p class="text-slate-600">
          Connect with Kafka and optional handoff. Envelopes must match your registered tenant config (topic, DB name,
          tenant id — see <strong>Set up</strong>) plus the same <code class="rounded bg-slate-200/60 px-1 py-0.5 text-xs">tenantId</code> /
          <code class="rounded bg-slate-200/60 px-1 py-0.5 text-xs">dBname</code> in each message.
        </p>

        <h2 class="text-base font-semibold text-slate-900 mt-8">Kafka messages</h2>
        <p>One JSON object per message; message key = marketing <code>tenantId</code>.</p>
        <p class="mt-2">Envelope: <code>eventType</code>, <code>occurredAt</code>, <code>dBname</code>, <code>tenantId</code>, <code>payload</code>.</p>

        <h3 class="text-sm font-semibold text-slate-900 mt-6">Contacts</h3>
        <ul>
          <li><code>contact.created</code> / <code>contact.updated</code> — full row in <code>payload</code></li>
          <li><code>contact.deleted</code> — <code>externalId</code>, <code>tenantId</code>, <code>dBname</code>; optional <code>metadata</code></li>
        </ul>
        <p class="mt-2">
          Payload fields include <code>externalId</code>, name parts, <code>email</code>, <code>phone</code>, <code>company</code>,
          <code>address</code> (<code>street</code>, <code>city</code>, <code>state</code>, <code>county</code>),
          <code>contactType</code> (<code>prospect</code>|<code>client</code>|<code>contact</code>), <code>channel</code>, optional
          <code>metadata</code> (<code>ownerId</code> / <code>ownerEmail</code>).
        </p>

        <h3 class="text-sm font-semibold text-slate-900 mt-6">Email templates</h3>
        <p>
          <code>marketing.email_template.created</code> | <code>.updated</code> | <code>.deleted</code> — same topic;
          <code>externalId</code>, name, subject, HTML, etc.
        </p>

        <h3 class="text-sm font-semibold text-slate-900 mt-6"><code>marketing.sync.requested</code></h3>
        <p>
          Optional snapshot when opening Marketing. Chunk large sets: shared <code>syncId</code>, <code>chunkIndex</code> /
          <code>chunkCount</code>. First chunk may include <code>ownerEmails</code>, <code>requestedByUserId</code>,
          <code>requestedByEmail</code>. <code>syncType</code>: <code>login_reconcile</code>. Keep chunks small enough for broker limits.
        </p>

        <h2 class="text-base font-semibold text-slate-900 mt-8">Contact visibility</h2>
        <ul>
          <li><strong>Scoped</strong> — restrict sync + JWT to allowed owners; set <code>metadata.ownerEmail</code> / <code>ownerId</code> on contacts; cap owner-email list size.</li>
          <li><strong>Tenant-wide</strong> — <code>tenantWideContacts: true</code> on handoff JWT; widen sync accordingly.</li>
          <li><strong>Simple default</strong> — single user email as owner filter.</li>
        </ul>
        <p class="mt-2 text-slate-600">Keep handoff JWT and sync rules aligned — see <strong>Auth</strong>.</p>

        <footer class="mt-10 border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
          Kafka config: <strong>Set up</strong>. Handoff JWT: <strong>Auth</strong>.
        </footer>
      </div>

      <!-- Set up -->
      <div v-show="activeTab === 'setup'" role="tabpanel" aria-label="Set up">
        <p class="text-slate-600">
          Same key names whether you store them as connection metadata, secrets, or environment variables. Ask your
          Marketing admin for values.
        </p>

        <h2 class="text-base font-semibold text-slate-900 mt-8">Tenant config (from Marketing admin)</h2>
        <p>These three identify the tenant in Marketing and must match what the consumer expects:</p>
        <ul>
          <li><code>TENANT_ID</code> — marketing registry tenant id (also Kafka message key)</li>
          <li><code>DB_NAME</code> — Marketing Mongo database name (<code>dBname</code> in envelopes)</li>
          <li><code>KAFKA_TOPIC_MARKETING_EVENTS</code> — topic name (often <code>marketing.events</code>)</li>
        </ul>
        <p class="mt-2 text-slate-600">You also need the tenant API key (<code>nmk_…</code>) for handoff JWTs.</p>

        <h2 class="text-base font-semibold text-slate-900 mt-8">Connection env keys</h2>
        <p class="text-slate-600">Broker and client settings (typical: <code>KAFKA_SSL</code> off and empty SASL for internal clusters).</p>
        <pre
          class="mt-3 overflow-x-auto rounded-xl border border-slate-700 bg-slate-900 p-4 text-xs leading-relaxed font-mono text-slate-100"
        >{{ kafkaConnectionEnvKeys }}</pre>
        <p class="mt-3 text-slate-600">
          <code>KAFKA_BROKERS</code> is required to connect. Together with the tenant config above, your producer can publish.
        </p>

        <h2 class="text-base font-semibold text-slate-900 mt-10">Retail backend (<code>MARKETING_*</code> in <code>.env</code>)</h2>
        <p class="text-slate-600">
          The <strong>retail-origination</strong> Nuxt app maps these environment variables in <code>nuxt.config</code> (server-side).
          Use your Marketing app origin for <code>MARKETING_BASE_URL</code> (no trailing slash). For local Redpanda from the host,
          use <code>127.0.0.1:19092</code> — not the Docker service hostname unless the retail server runs on the same Docker network.
          Set <code>MARKETING_KAFKA_SSL=false</code> for local plaintext; defaults in code assume TLS unless you disable it.
        </p>
        <p class="mt-2 text-slate-600">
          <strong>Tenant-specific</strong> settings belong in the same <code>.env</code> but are <strong>not</strong> listed below:
          <code>MARKETING_DB_NAME</code>, <code>MARKETING_TENANT_ID</code>, <code>MARKETING_API_KEY</code> (<code>nmk_…</code>),
          and <code>MARKETING_KAFKA_TOPIC_MARKETING_EVENTS</code> — copy those from your Marketing admin / tenant registry
          (same meanings as <code>DB_NAME</code>, <code>TENANT_ID</code>, tenant API key, and <code>KAFKA_TOPIC_MARKETING_EVENTS</code> above).
        </p>
        <p class="mt-2 text-slate-600">
          Handoff <code>iss</code> / <code>aud</code> must match this app&rsquo;s
          <code>marketingHandoffIss</code> / <code>marketingHandoffAud</code> (defaults shown in <strong>Auth</strong>).
        </p>
        <pre
          class="mt-3 overflow-x-auto rounded-xl border border-slate-700 bg-slate-900 p-4 text-xs leading-relaxed font-mono text-slate-100"
        >{{ retailMarketingEnvKeys }}</pre>
        <p class="mt-3 text-xs text-slate-500 font-mono">
          Example (fill in brokers; adjust iss/aud only if you changed them in Marketing):
        </p>
        <pre
          class="mt-2 overflow-x-auto rounded-xl border border-slate-700 bg-slate-900 p-4 text-xs leading-relaxed font-mono text-slate-100"
        >MARKETING_BASE_URL=http://localhost:3001
MARKETING_HANDOFF_JWT_ISS=marketing-tenant
MARKETING_HANDOFF_JWT_AUD=new-marketing
MARKETING_KAFKA_BROKERS=127.0.0.1:19092
MARKETING_KAFKA_CLIENT_ID=retail-origination
MARKETING_KAFKA_SSL=false
MARKETING_KAFKA_USERNAME=
MARKETING_KAFKA_PASSWORD=
MARKETING_KAFKA_SASL_MECHANISM=plain</pre>

        <footer class="mt-10 border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
          Event shapes: <strong>Overview</strong>. Handoff JWT: <strong>Auth</strong>.
        </footer>
      </div>

      <!-- Sending events -->
      <div v-show="activeTab === 'sending'" role="tabpanel" aria-label="Sending events">
        <p class="text-slate-600">
          This tab is for the producer side (CRM) and how Marketing consumes those messages.
        </p>

        <h2 class="text-base font-semibold text-slate-900 mt-8">Where to send</h2>
        <p class="text-slate-600">
          You send to your Kafka <strong>cluster</strong> (brokers), on one <strong>topic</strong>, with each record&rsquo;s
          <strong>key</strong> and <strong>value</strong> set like this:
        </p>
        <pre
          class="mt-2 overflow-x-auto rounded-xl border border-slate-700 bg-slate-900 p-4 text-xs leading-relaxed font-mono text-slate-100"
        >{{ whereToSendKafka }}</pre>
        <p class="mt-2 text-slate-600">
          The reference CRM producer publishes every inbound event type to that single topic name (not per-tenant topic
          suffixes). Marketing&rsquo;s consumer subscribes to the <strong>base</strong> topic above and also to
          <code>&lt;base&gt;.&lt;suffix&gt;</code> topics derived from registered tenants; using the base topic is the
          usual path for CRM-style contact/template/sync events. If your admin gives a non-default topic, use that exact
          string for <code>KAFKA_TOPIC_MARKETING_EVENTS</code>.
        </p>

        <h2 class="text-base font-semibold text-slate-900 mt-8">How CRM resolves runtime</h2>
        <p class="text-slate-600">
          CRM first checks enabled external-connection metadata for Kafka values, then falls back per field to env.
          If <code>KAFKA_BROKERS</code> is empty, publish is skipped.
        </p>
        <ul>
          <li><code>KAFKA_BROKERS</code>, <code>KAFKA_SSL</code>, <code>KAFKA_USERNAME</code>, <code>KAFKA_PASSWORD</code>, <code>KAFKA_CLIENT_ID</code>, <code>KAFKA_SASL_MECHANISM</code></li>
          <li><code>KAFKA_TOPIC_MARKETING_EVENTS</code> defaults to <code>marketing.events</code></li>
          <li><code>TENANT_ID</code> and <code>DB_NAME</code> must be the Marketing tenant values (not CRM registry ids)</li>
        </ul>

        <h2 class="text-base font-semibold text-slate-900 mt-8">Event types CRM publishes</h2>
        <pre
          class="mt-2 overflow-x-auto rounded-xl border border-slate-700 bg-slate-900 p-4 text-xs leading-relaxed font-mono text-slate-100"
        >{{ crmEventTypes }}</pre>

        <h2 class="text-base font-semibold text-slate-900 mt-8">Envelope shape and Kafka key</h2>
        <p class="text-slate-600">
          CRM publishes one JSON envelope per message. Kafka message <code>key</code> should be the Marketing
          <code>tenantId</code>. Keep root <code>tenantId</code>/<code>dBname</code> aligned with payload values.
        </p>
        <pre
          class="mt-2 overflow-x-auto rounded-xl border border-slate-700 bg-slate-900 p-4 text-xs leading-relaxed font-mono text-slate-100"
        >{{ crmEnvelopeExample }}</pre>

        <h2 class="text-base font-semibold text-slate-900 mt-8">Snapshot sync — <code>marketing.sync.requested</code></h2>
        <p class="text-slate-600">
          Use this to push a <strong>bulk contact snapshot</strong> (for example right after handoff / when opening
          Marketing). Same Kafka destination as other events: base topic, key = Marketing <code>tenantId</code>.
        </p>
        <ul class="mt-2">
          <li>
            <code>syncType</code> should be <code>login_reconcile</code> (reference CRM uses this when reconciling after
            launch).
          </li>
          <li>
            Split large lists into multiple Kafka messages: one shared <code>syncId</code>, <code>chunkIndex</code> from
            <code>1</code> … <code>chunkCount</code>, same <code>occurredAt</code> across the run is fine.
          </li>
          <li>
            <strong>First chunk only:</strong> include <code>ownerEmails</code> (lowercased, de-duplicated) when
            <code>tenantWideContacts</code> is <code>false</code>; omit or use an empty list when tenant-wide. Optional
            <code>requestedByUserId</code> / <code>requestedByEmail</code> on the first chunk for audit trails.
          </li>
          <li>
            <strong>CRM chunk size:</strong> env <code>MARKETING_SYNC_CHUNK_SIZE</code> (default <code>25</code>, clamped
            between <code>5</code> and <code>120</code> contacts per message) to stay under broker size limits.
          </li>
          <li>
            Each <code>contacts[]</code> entry mirrors contact fields (plus optional <code>metadata</code> for
            <code>ownerId</code> / <code>ownerEmail</code> on the row).
          </li>
        </ul>
        <p class="mt-2 text-slate-600">
          Marketing handles each message by <strong>upserting</strong> the contacts in that chunk into the tenant DB
          (source <code>crm-kafka</code>). Align this snapshot with your ongoing <code>contact.*</code> stream and
          handoff <code>ownerEmails</code> / <code>tenantWideContacts</code> so visibility stays consistent.
        </p>
        <pre
          class="mt-2 overflow-x-auto rounded-xl border border-slate-700 bg-slate-900 p-4 text-xs leading-relaxed font-mono text-slate-100"
        >{{ syncRequestedExample }}</pre>
        <p class="mt-2 text-sm text-slate-600">
          Chunks after the first repeat the same envelope shape but usually only add <code>contacts</code> (no
          <code>ownerEmails</code> / <code>requestedBy*</code>).
        </p>

        <h2 class="text-base font-semibold text-slate-900 mt-8">How Marketing consumes</h2>
        <ul>
          <li>Consumer subscribes to the base topic plus tenant-scoped topics when present.</li>
          <li>Only inbound platform events are handled: contact.*, email_template.*, and <code>marketing.sync.requested</code>.</li>
          <li>Invalid schema or non-JSON messages are skipped with logs.</li>
        </ul>

        <h2 class="text-base font-semibold text-slate-900 mt-8">Common mistakes</h2>
        <ul>
          <li>Using CRM tenant id instead of Marketing <code>TENANT_ID</code> in envelope/payload.</li>
          <li>Missing <code>DB_NAME</code>, which breaks tenant routing on the Marketing side.</li>
          <li>Large sync snapshots without chunking; keep <code>marketing.sync.requested</code> chunked.</li>
        </ul>

        <footer class="mt-10 border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
          Kafka schema basics: <strong>Overview</strong>. Runtime keys: <strong>Set up</strong>. Session handoff: <strong>Auth</strong>.
        </footer>
      </div>

      <!-- Auth -->
      <div v-show="activeTab === 'auth'" role="tabpanel" aria-label="Auth" class="auth-doc">
        <h2 class="text-base font-semibold text-slate-900">Overview</h2>
        <p class="text-slate-600">
          Sign users into Marketing from your product <strong>without Firebase</strong>: your server creates a
          <strong>short-lived</strong> JWT; the user is <strong>redirected</strong> here; Marketing exchanges it for an
          <strong>httpOnly</strong> session cookie.
        </p>

        <h2 class="text-base font-semibold text-slate-900 mt-8">At a glance</h2>
        <ol class="auth-flow-list list-decimal space-y-2 pl-5 text-slate-700">
          <li>Your <strong>backend</strong> builds and signs the JWT (never put the raw <code>nmk_</code> key in frontend code).</li>
          <li>
            <strong>Redirect</strong> the user&rsquo;s browser to
            <code class="rounded bg-slate-200/70 px-1 py-0.5 text-xs">/auth/tenant-callback?token=&lt;url-encoded-jwt&gt;</code>
            on your Marketing origin.
          </li>
          <li>
            This app&rsquo;s callback page <code>POST</code>s
            <code class="rounded bg-slate-200/70 px-1 py-0.5 text-xs">/api/v1/auth/tenant-handoff</code> with
            <code class="rounded bg-slate-200/70 px-1 py-0.5 text-xs">{ "token": "…" }</code> (you usually do not call this yourself).
          </li>
          <li>Marketing verifies the JWT, sets cookies, then redirects to <code>/tenant/dashboard</code>.</li>
        </ol>

        <h2 class="text-base font-semibold text-slate-900 mt-8">GET — redirect URL</h2>
        <p class="text-slate-600">
          <strong>Why GET:</strong> The user&rsquo;s browser moves from your product to Marketing in one step, and the
          one-time JWT travels in the URL—your frontend and Marketing&rsquo;s frontend never need a direct integration
          for that hop. Use <code>encodeURIComponent</code> on the JWT so characters like <code>.</code> do not break the
          query string.
        </p>
        <pre
          class="mt-2 overflow-x-auto rounded-xl border border-slate-700 bg-slate-900 p-4 text-xs leading-relaxed font-mono text-slate-100"
        >https://&lt;marketing-host&gt;/auth/tenant-callback?token=&lt;url-encoded-jwt&gt;</pre>

        <h2 class="text-base font-semibold text-slate-900 mt-8">Server configuration</h2>
        <p class="text-slate-600">
          Store per-tenant values in <strong>your database or secrets store</strong> (whatever you use for integration
          settings)—not necessarily environment variables. Your Marketing admin provides the real values.
        </p>
        <ul class="mt-2 list-disc space-y-1 pl-5 text-slate-700">
          <li><code>baseUrl</code> — Marketing site origin (build the redirect URL)</li>
          <li><code>apiKey</code> — <code>nmk_…</code> string; used as the HMAC secret and as JWT claim <code>k</code></li>
          <li><code>TENANT_ID</code> — marketing registry id; use as JWT claim <code>sub</code></li>
        </ul>
        <p class="mt-2 text-slate-600">
          Handoff JWT lifetime: typically <strong>~300 seconds</strong> between <code>iat</code> and <code>exp</code>. Kafka
          producer keys are on <strong>Set up</strong>.
        </p>

        <h2 class="text-base font-semibold text-slate-900 mt-8">JWT signing</h2>
        <p>
          <strong>HS256.</strong> Header: <code>{ "alg": "HS256", "typ": "JWT" }</code>. Payload: JSON below. Sign
          <code>base64url(header) + "." + base64url(payload)</code> with HMAC-SHA256 using the <strong>full</strong>
          <code>nmk_…</code> key (same string as claim <code>k</code>). Result: three base64url segments separated by
          <code>.</code>
        </p>

        <h2 class="text-base font-semibold text-slate-900 mt-8">Issuer and audience (<code>iss</code> / <code>aud</code>)</h2>
        <p class="text-slate-600">
          Standard JWT claims: <code>iss</code> = who <strong>issued</strong> the token, <code>aud</code> = who it is
          <strong>for</strong>. They are not tenant id or API key.
        </p>
        <p class="mt-2 text-slate-600">
          This server only accepts <code>iss</code> <code>marketing-tenant</code> and <code>aud</code>
          <code>new-marketing</code> — a fixed pairing so other tokens are rejected early. Treat them like required
          protocol constants. <strong>Tenant identity</strong> is <code>sub</code> + <code>k</code> + the signature.
        </p>

        <h2 class="text-base font-semibold text-slate-900 mt-8">Required claims</h2>
        <p class="text-slate-600">
          Use your real <code>sub</code> and <code>k</code>; <code>iss</code> and <code>aud</code> must match the literals
          above.
        </p>
        <pre
          class="mt-2 overflow-x-auto rounded-xl border border-slate-700 bg-slate-900 p-4 text-xs leading-relaxed font-mono text-slate-100"
        >{{ jwtPayloadRequiredExample }}</pre>

        <h2 class="text-base font-semibold text-slate-900 mt-8">Optional claims</h2>
        <p class="text-slate-600">
          Profile fields for the session UI. For contact visibility: either <code>tenantWideContacts: true</code>
          <em>or</em> <code>ownerEmails</code> (lowercased list; Marketing accepts at most <strong>50</strong> emails).
          Match whatever you send in Kafka sync so the UI stays consistent.
        </p>
        <pre
          class="mt-2 overflow-x-auto rounded-xl border border-slate-700 bg-slate-900 p-4 text-xs leading-relaxed font-mono text-slate-100"
        >{{ jwtPayloadOptionalExample }}</pre>
        <p class="mt-2 text-sm text-slate-600">
          Tenant-wide: use <code>"tenantWideContacts": true</code> and omit <code>ownerEmails</code>.
        </p>

        <h2 class="text-base font-semibold text-slate-900 mt-8">API — <code>POST /api/v1/auth/tenant-handoff</code></h2>
        <p class="text-slate-600">
          <strong>Why POST:</strong> Marketing&rsquo;s server verifies the JWT (signature, <code>iss</code>/<code>aud</code>,
          expiry, tenant/key) and then issues an <strong>httpOnly</strong> session cookie. You do not keep relying on the
          token in the address bar. <code>credentials: 'include'</code> lets the browser send and store cookies for this
          Marketing origin on follow-up requests.
        </p>
        <p class="mt-2 text-slate-600">
          Called from this Marketing origin (the callback page). Typical errors: <code>400</code> missing body,
          <code>401</code> invalid or expired token / unknown key / tenant mismatch.
        </p>
        <p class="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Request body</p>
        <pre
          class="mt-1 overflow-x-auto rounded-xl border border-slate-700 bg-slate-900 p-4 text-xs leading-relaxed font-mono text-slate-100"
        >{{ handoffRequestExample }}</pre>
        <p class="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Response <span class="font-normal text-slate-400">(200)</span></p>
        <pre
          class="mt-1 overflow-x-auto rounded-xl border border-slate-700 bg-slate-900 p-4 text-xs leading-relaxed font-mono text-slate-100"
        >{{ handoffResponseExample }}</pre>

        <h2 class="text-base font-semibold text-slate-900 mt-8">Security</h2>
        <ul class="list-disc space-y-1 pl-5 text-slate-700">
          <li>Sign tokens only on the server; do not ship the <code>nmk_</code> secret in client bundles or public env.</li>
          <li>Keep handoff JWTs short-lived; session persistence uses httpOnly cookies after exchange.</li>
        </ul>

        <h2 class="text-base font-semibold text-slate-900 mt-8">Integrating your frontend</h2>
        <p class="text-slate-600">
          Have your API return a ready-made URL (e.g. <code>{ "url": "https://…/auth/tenant-callback?token=…" }</code>),
          then call <code>window.location.replace(url)</code> or return an HTTP redirect.
        </p>

        <p class="mt-10 text-sm text-slate-600 border-t border-slate-200 pt-6">
          <strong>Summary:</strong> server-signed JWT → redirect to callback → Marketing POSTs handoff → httpOnly session →
          dashboard. Full markdown reference: <code class="text-xs">docs/tenant-handoff-authentication.md</code>.
        </p>

        <footer class="mt-6 text-center text-xs text-slate-500">
          Tenant ids &amp; keys: <strong>Set up</strong>. Kafka: <strong>Overview</strong>.
        </footer>
      </div>
    </main>
  </div>
</template>

<style scoped>
main h2 + p,
main h3 + p {
  margin-top: 0.5rem;
}
main ul {
  list-style-type: disc;
  padding-left: 1.25rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}
main li {
  margin-top: 0.2rem;
}
main code {
  font-size: 0.85em;
}
.auth-doc h2 {
  scroll-margin-top: 0.5rem;
}
</style>
