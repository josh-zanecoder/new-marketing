# Tenant handoff authentication

## Overview

Tenant handoff lets you sign users into the Marketing web app from your own product **without** Firebase. Your **server** mints a short-lived HS256 JWT and your **frontend** redirects the user to Marketing. Marketing’s callback page exchanges that JWT for **httpOnly** session cookies via a single POST. The raw tenant API key (`nmk_…`) must never be stored in frontend code or sent except as the signed claim `k` inside the JWT.

---

## Authentication flow

1. **Your backend** loads per-tenant configuration: Marketing base URL, marketing `tenantId`, and the tenant API key (`nmk_…`). See [Server configuration](#server-configuration).
2. **Your backend** builds the JWT payload (required + optional claims), signs it with HS256 using the **full** `nmk_…` string as the secret, and produces a compact JWT string.
3. **Your backend** returns a full redirect URL to your frontend, or issues an HTTP redirect. The URL must point at Marketing’s tenant callback and include the JWT as a query parameter (URL-encoded).
4. **The user’s browser** navigates to that URL (`GET`). No request body is sent on this step.
5. **Marketing’s** `/auth/tenant-callback` page runs in the browser, clears any existing Firebase session for Marketing, then **`POST`s** the JWT to `/api/v1/auth/tenant-handoff` on the **same origin** with `credentials: 'include'`.
6. **Marketing’s API** validates the JWT, sets session cookies (including an **httpOnly** session JWT), and returns JSON. The callback page then redirects the user to `/tenant/dashboard`.

Integrators implement steps 1–3. Steps 4–6 are fixed behavior of the Marketing application.

---

## GET flow (browser redirect)

Redirect the user (or open a top-level navigation) to:

```text
https://<MARKETING_HOST>/auth/tenant-callback?token=<URL_ENCODED_JWT>
```

Rules:

- Use your deployed Marketing origin (scheme + host, no trailing slash on the host).
- Encode the entire JWT with `encodeURIComponent` (or equivalent) as the `token` query value.
- This is a normal browser `GET`; do not send the JWT in a header on this step.

**Example**

```text
https://marketing.example.com/auth/tenant-callback?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJtb3J0ZGFzaC1jcm0iLCJhdWQiOiJtb3J0ZGFzaC1tYXJrZXRpbmciLCJzdWIiOiI5MjkzYmU1ZS1mZmU0LTQ0YTEtYTcyNC0xNTk2YmU5N2M3NTAiLCJpYXQiOjE3MzAwMDAwMDAsImV4cCI6MTczMDAwMDMwMCwiayI6Im5ta19leGFtcGxlX2tleV9kZXZfb25seSJ9.SIGNATURE
```

---

## POST flow (token exchange)

Marketing’s callback page calls this endpoint; **you do not need to call it from your servers** unless you are replicating the callback behavior.

```http
POST /api/v1/auth/tenant-handoff
Host: <MARKETING_HOST>
Content-Type: application/json
```

The request must be made from the browser with cookies enabled for the Marketing origin (`credentials: 'include'`).

---

## Server configuration

Store these values **per tenant** in your database, secrets manager, or integration settings (not hard-coded in the client).

| Input | Purpose |
|--------|---------|
| Marketing **base URL** | Origin used to build `https://<host>/auth/tenant-callback?token=…` |
| **Tenant API key** | String starting with `nmk_`; used as HS256 secret and as JWT claim `k` |
| **Marketing tenant id** | UUID (or registry id) for JWT claim `sub`; must match the registry row for that API key when the registry stores a tenant id |
| **Owner scope** (optional) | Logic to populate `ownerEmails` or `tenantWideContacts` so Marketing contact lists match your authorization model |

Kafka producer settings (`KAFKA_BROKERS`, `TENANT_ID`, `DB_NAME`, topic, etc.) are separate; they are documented for event publishing, not for this handoff.

**Security**

- Sign the handoff JWT **only on your server**.
- Use a **short TTL** for the handoff JWT (commonly **300 seconds** between `iat` and `exp`).
- After exchange, Marketing sets a longer-lived **httpOnly** session cookie (`marketing_tenant_session`); the handoff JWT itself should remain short-lived.

---

## JWT signing

- **Algorithm:** HS256.
- **Header (JSON):** `{ "alg": "HS256", "typ": "JWT" }`
- **Encoding:** Base64url-encode the header and payload without padding, join with `.`, then compute  
  `HMAC-SHA256( UTF8(header) + "." + UTF8(payload), secret )`  
  where **secret** is the full **`nmk_…` API key string** (same value as claim `k`).
- Base64url-encode the signature and append as the third segment.

Marketing verifies the signature using the key in claim `k` and checks that key against the tenant registry.

---

## Required claims

All of the following belong in the JWT **payload** (decoded JSON object).

| Claim | Type | Description |
|--------|------|-------------|
| `iss` | string | **This server:** must be exactly `mortdash-crm` (legacy fixed issuer string). |
| `aud` | string | **This server:** must be exactly `mortdash-marketing` (legacy fixed audience string). |
| `sub` | string | Marketing registry tenant id for this tenant. |
| `iat` | number | Issued-at time (Unix seconds). |
| `exp` | number | Expiration (Unix seconds). Must be in the future when Marketing validates. |
| `k` | string | Full tenant API key (`nmk_…`). Used as signature secret and for registry lookup. |

---

## Optional claims

| Claim | Type | Description |
|--------|------|-------------|
| `email` | string | Shown in Marketing session / UI. |
| `firstName` | string | Profile. |
| `lastName` | string | Profile. |
| `phone` | string | Profile. |
| `role` | string | Display label for the user’s role. |
| `tenantWideContacts` | boolean | If `true`, Marketing does not restrict contacts by owner email list. |
| `ownerEmails` | string[] | Lowercased emails allowed for contact ownership filtering. Ignored when `tenantWideContacts` is true. Maximum **50** entries enforced server-side. |

Align `tenantWideContacts` / `ownerEmails` with whatever you send in Kafka login-reconcile events so the UI and data stay consistent.

### Sample JWT payload (decoded)

The `iss` and `aud` values below are **illustrative** (generic partner / marketing labels). **Production tokens for this Marketing deployment must use** `iss`: `mortdash-crm` and `aud`: `mortdash-marketing` exactly, as enforced by the verifier.

Scoped user (owner list):

```json
{
  "iss": "https://api.partner.example",
  "aud": "urn:example:marketing-handoff",
  "sub": "9293be5e-ffe4-44a1-a724-1596be97c750",
  "iat": 1730000000,
  "exp": 1730000300,
  "k": "nmk_example_key_dev_only",
  "email": "jane@example.com",
  "firstName": "Jane",
  "lastName": "Doe",
  "role": "Loan Officer",
  "ownerEmails": ["jane@example.com", "reports@example.com"]
}
```

Tenant-wide access:

```json
{
  "iss": "https://api.partner.example",
  "aud": "urn:example:marketing-handoff",
  "sub": "9293be5e-ffe4-44a1-a724-1596be97c750",
  "iat": 1730000000,
  "exp": 1730000300,
  "k": "nmk_example_key_dev_only",
  "email": "admin@example.com",
  "tenantWideContacts": true
}
```

Replace `k` and `sub` with real values from your Marketing administrator. For live handoff, set `iss` / `aud` to the required literals in the table above, not the sample strings shown here.

---

## API endpoint (request / response)

### `POST /api/v1/auth/tenant-handoff`

**Request body**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

| Field | Type | Required |
|--------|------|----------|
| `token` | string | Yes — compact JWT from your server |

**Success — `200 OK`**

```json
{
  "ok": true,
  "tenantName": "Acme Mortgage"
}
```

On success, the response includes `Set-Cookie` headers: an **httpOnly** session cookie (`marketing_tenant_session`) and a bridge flag cookie (`marketing_tenant_bridge`). The Marketing app also clears the `marketing_token` cookie if present.

**Error responses**

| Status | Typical cause |
|--------|----------------|
| `400` | Missing `token` in body, or invalid key material in payload |
| `401` | Invalid signature, expired JWT, unknown API key, or `sub` does not match registry tenant id |

Error bodies follow the API’s standard shape (e.g. `statusCode` and `message`).

---

## Summary

| Step | Who | Action |
|------|-----|--------|
| 1 | Your server | Sign short-lived HS256 JWT; include required claims; optional profile and scope claims. |
| 2 | Your app | Redirect user to `GET /auth/tenant-callback?token=…` on Marketing. |
| 3 | Marketing (browser) | `POST /api/v1/auth/tenant-handoff` with `{ "token" }`, receive cookies, redirect to `/tenant/dashboard`. |

Never expose the `nmk_…` secret in frontend source or environment variables shipped to the client. Keep handoff tokens short-lived; rely on Marketing’s httpOnly session cookie after exchange.
