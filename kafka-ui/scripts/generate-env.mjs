import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function parseEnvFile(content) {
  const env = {}
  for (const line of content.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

function buildBase64SaPassword(email, privateKey, projectId) {
  const pk = privateKey.replace(/\\n/g, '\n')
  const saJson = JSON.stringify({
    type: 'service_account',
    project_id: projectId || 'default',
    private_key_id: '',
    private_key: pk,
    client_email: email,
    client_id: '',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: ''
  })
  return Buffer.from(saJson, 'utf8').toString('base64')
}

function buildJaas(username, password) {
  return `org.apache.kafka.common.security.plain.PlainLoginModule required username="${username}" password="${password}";`
}

function main() {
  const sourcePath = path.resolve(process.argv[2] || path.join(__dirname, '../../.env.production'))
  const outPath = path.resolve(process.argv[3] || path.join(__dirname, '../.env.production'))
  if (!fs.existsSync(sourcePath)) {
    console.error(`Source env not found: ${sourcePath}`)
    process.exit(1)
  }
  const env = parseEnvFile(fs.readFileSync(sourcePath, 'utf8'))
  const brokers = env.KAFKA_BROKERS?.trim()
  const email = env.KAFKA_SA_CLIENT_EMAIL?.trim()
  const privateKey = env.KAFKA_SA_PRIVATE_KEY?.trim()
  const projectId = env.KAFKA_SA_PROJECT_ID?.trim()
  if (!brokers) {
    console.error('KAFKA_BROKERS is required in source env')
    process.exit(1)
  }
  if (!email || !privateKey) {
    console.error('KAFKA_SA_CLIENT_EMAIL and KAFKA_SA_PRIVATE_KEY are required in source env')
    process.exit(1)
  }
  const clusterName = env.KAFKA_CLUSTER_UI_NAME?.trim() || 'marketing-production-crm'
  const password = buildBase64SaPassword(email, privateKey, projectId)
  const jaas = buildJaas(email, password)
  const lines = [
    `# Generated from ${sourcePath} — do not commit`,
    `KAFKA_CLUSTERS_0_NAME=${clusterName}`,
    `KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS=${brokers}`,
    'KAFKA_CLUSTERS_0_PROPERTIES_SECURITY_PROTOCOL=SASL_SSL',
    'KAFKA_CLUSTERS_0_PROPERTIES_SASL_MECHANISM=PLAIN',
    `KAFKA_CLUSTERS_0_PROPERTIES_SASL_JAAS_CONFIG=${jaas}`
  ]
  fs.writeFileSync(outPath, `${lines.join('\n')}\n`, { mode: 0o600 })
  console.log(`Wrote ${outPath} (cluster: ${clusterName})`)
}

main()
