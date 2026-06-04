# Admin: CRM external connection JSON modal

Guide for the **CRM external connection** modal in Marketing admin (`/admin/tenants`). Use it after creating a tenant or regenerating an API key to copy paste-ready JSON into **mortdash-crm** External Connections.

**CRM setup (mortdash-crm):** [MARKETING_EXTERNAL_CONNECTION_SETUP.md](../../mortdash-crm/docs/MARKETING_EXTERNAL_CONNECTION_SETUP.md)

**Launch sync (CRM + worker):** [marketing-crm-launch-sync.md](./marketing-crm-launch-sync.md) · CRM side: [MARKETING_LAUNCH_SYNC_DELTA.md](../../mortdash-crm/docs/MARKETING_LAUNCH_SYNC_DELTA.md)

---

## Where it appears

| Action | Modal title |
|--------|-------------|
| **Add tenant** (success) | Tenant created – CRM external connection |
| **Regenerate** (tenants table or inside modal) | API key regenerated – update CRM metadata |

The modal shows:

1. **Summary** — DB name, tenant ID, Kafka topic, Marketing app URL, bridge URL, handoff iss/aud  
2. **Full JSON** — includes `MARKETING_API_KEY` and `KAFKA_BRIDGE_TOKEN`  
3. **Copy JSON** — one click to clipboard  

The API key is **only shown in this modal** (not stored in plain text after close). Copy before dismissing.

---

## Example JSON (test / develop)

```json
{
  "DB_NAME": "15k_db",
  "TENANT_ID": "a4c98579-acef-4ec1-88f3-299933142880",
  "KAFKA_MODE": "bridge",
  "KAFKA_BRIDGE_URL": "https://marketing-kafka-producer-bridge-980800581325.us-west1.run.app",
  "MARKETING_API_KEY": "nmk_…",
  "MARKETING_APP_URL": "https://marketing-test-980800581325.us-west1.run.app/",
  "KAFKA_BRIDGE_TOKEN": "…",
  "MARKETING_HANDOFF_JWT_AUD": "new-marketing",
  "MARKETING_HANDOFF_JWT_ISS": "marketing-tenant",
  "KAFKA_TOPIC_MARKETING_EVENTS": "marketing.events.15k"
}
```

Production uses `marketing-production` and `marketing-kafka-producer-bridge-production` URLs when `MARKETING_DEPLOY_ENV=production` (see env below).

---

## JSON field reference

| Key | Source | Notes |
|-----|--------|--------|
| `DB_NAME` | Marketing registry | Tenant Mongo DB name (e.g. `15k_db`) |
| `TENANT_ID` | Marketing registry | **Marketing** tenant UUID — not CRM registry id |
| `KAFKA_MODE` | Always `bridge` | CRM publishes via HTTP bridge |
| `KAFKA_BRIDGE_URL` | Marketing deployment env | No trailing slash |
| `MARKETING_API_KEY` | Generated on create/regenerate | Full `nmk_…` key; update CRM after regenerate |
| `MARKETING_APP_URL` | Marketing deployment env | Marketing **web** URL (trailing `/` ok) |
| `KAFKA_BRIDGE_TOKEN` | Marketing deployment env | Same value as bridge secret `BRIDGE_TOKEN` |
| `MARKETING_HANDOFF_JWT_ISS` | Marketing env (default `marketing-tenant`) | Must match CRM handoff JWT issuer |
| `MARKETING_HANDOFF_JWT_AUD` | Marketing env (default `new-marketing`) | Must match Marketing handoff validator |
| `KAFKA_TOPIC_MARKETING_EVENTS` | Per-tenant Kafka topic | e.g. `marketing.events.15k` |

Implementation: `shared/types/crmExternalConnection.ts`, `server/utils/admin/buildCrmExternalConnectionMetadata.ts`.

---

## Regenerate API key

**Regenerate** rotates **only** `MARKETING_API_KEY`. All other JSON fields stay the same.

Ways to regenerate:

- Tenants table → **Regenerate** → confirm → modal with updated JSON  
- Inside the CRM modal → **Regenerate API key** → confirm → JSON updates in place  

After regenerate, paste the **full JSON** into mortdash-crm metadata again (or at minimum update `MARKETING_API_KEY`). Old keys return **401** on tenant handoff.

---

## Marketing deployment env (Secret Manager)

Add to **`marketing-test`** or **`marketing-production`** secret so the modal fills bridge URL, app URL, and token:

```env
MARKETING_DEPLOY_ENV=develop
MARKETING_APP_URL=https://marketing-test-980800581325.us-west1.run.app/
KAFKA_BRIDGE_URL=https://marketing-kafka-producer-bridge-980800581325.us-west1.run.app
KAFKA_BRIDGE_TOKEN=<same as bridge secret BRIDGE_TOKEN>
```

Production:

```env
MARKETING_DEPLOY_ENV=production
MARKETING_APP_URL=https://marketing-production-980800581325.us-west1.run.app/
KAFKA_BRIDGE_URL=https://marketing-kafka-producer-bridge-production-980800581325.us-west1.run.app
KAFKA_BRIDGE_TOKEN=<production bridge BRIDGE_TOKEN>
```

If `KAFKA_BRIDGE_TOKEN` is missing on Marketing, the modal shows a warning; JSON still copies but CRM bridge publish may fail until the secret is set.

When `MARKETING_DEPLOY_ENV=develop|production` and URL overrides are omitted, built-in defaults match the URLs above (`server/utils/admin/resolveCrmIntegrationConfig.ts`).

Redeploy **`marketing-test`** / **`marketing-production`** (web only is enough) after secret changes.

---

## End-to-end flow

```text
Marketing admin → Add tenant → CRM JSON modal → copy JSON
       ↓
mortdash-crm → Admin → Tenant Configuration → External Connections → paste metadata
       ↓
CRM → bridge → Kafka → marketing-kafka-worker → contacts / templates / sync
       ↓
User opens Marketing from CRM → handoff uses MARKETING_APP_URL + MARKETING_API_KEY
```

---

## Related docs

- [MARKETING_EXTERNAL_CONNECTION_SETUP.md](../../mortdash-crm/docs/MARKETING_EXTERNAL_CONNECTION_SETUP.md) — mortdash-crm form + metadata  
- [KAFKA_BRIDGE_MODE_CLOUD_RUN_SETUP.md](../../mortdash-crm/docs/KAFKA_BRIDGE_MODE_CLOUD_RUN_SETUP.md) — bridge mode details  
- [marketing-sync-stuck-backlog-runbook.md](./marketing-sync-stuck-backlog-runbook.md) — sync troubleshooting  
- [cloud-run-service-split.md](./cloud-run-service-split.md) — web vs worker  
- [deploy-test-optional-services.md](./deploy-test-optional-services.md) — optional worker/bridge deploy on test  
