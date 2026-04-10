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

type DocsTab = 'overview' | 'setup' | 'auth'

const activeTab = ref<DocsTab>('overview')

const tabs: { id: DocsTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'setup', label: 'Set up' },
  { id: 'auth', label: 'Auth' }
]

/** Connection / producer keys (metadata or env). Tenant id, DB name, and topic are separate — see Set up tab. */
const kafkaConnectionEnvKeys = `KAFKA_BROKERS
KAFKA_SSL
KAFKA_USERNAME
KAFKA_PASSWORD
KAFKA_CLIENT_ID
KAFKA_SASL_MECHANISM`

/** Sample decoded JWT payload (illustrative iss/aud — see Required claims note on this server). */
const jwtPayloadRequiredExample = `{
  "iss": "https://api.partner.example",
  "aud": "urn:example:marketing-handoff",
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

        <footer class="mt-10 border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
          Event shapes: <strong>Overview</strong>. Handoff JWT: <strong>Auth</strong>.
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
        <p class="text-slate-600">Encode the JWT with <code>encodeURIComponent</code> before placing it in the query string.</p>
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

        <h2 class="text-base font-semibold text-slate-900 mt-8">Required claims</h2>
        <p class="text-slate-600">
          The JSON below is a <strong>sample shape</strong> only. For tokens this Marketing server will accept,
          <code>iss</code> must be exactly <code>mortdash-crm</code> and <code>aud</code> exactly
          <code>mortdash-marketing</code> (fixed protocol values — replace <code>sub</code> and <code>k</code> with your
          real tenant id and API key).
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
          Called from this Marketing origin with <code>credentials: 'include'</code>. Typical errors: <code>400</code> missing
          body, <code>401</code> invalid or expired token / unknown key / tenant mismatch.
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
