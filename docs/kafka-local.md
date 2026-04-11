# Kafka (local) — new-marketing

This project can publish marketing events to **Apache Kafka**. For local development we use **Redpanda** (Kafka-compatible) and optional **Redpanda Console** via Docker.

## What Kafka does here

- **Not** used to send email (that is **Redis + BullMQ + worker + Brevo**).
- **Used** to emit **integration events** (e.g. `campaign.send.completed`) so other services can subscribe without polling your HTTP API.
- If `KAFKA_BROKERS` is unset, the producer **does nothing**; the app still runs.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- Ports **19092** (broker) and **8080** (Console) free on your machine

## 1. Start Redpanda and Console

From the `new-marketing` directory:

```bash
docker compose -f docker-compose.kafka.yml up -d
```

Services:

| Service   | Container name           | Port  |
|----------|---------------------------|-------|
| Redpanda | `new-marketing-redpanda`  | 19092 |
| Console  | `new-marketing-console`   | 8080  |

Stop:

```bash
docker compose -f docker-compose.kafka.yml down
```

## Per-tenant topic names (prod / multi-tenant)

Outbound events are published to **one topic per tenant**. By default the name is:

`{KAFKA_TOPIC_MARKETING_EVENTS or marketing.events}.{sanitized tenant name}`

Admin **create** and **edit** tenant flows compute the default outbound topic from the tenant **display name** and persist it as **`kafkaOutboundTopic`** on the registry `clients` row. To use a **different full topic name** (e.g. `cbc_crm.marketing.out`), set **`kafkaOutboundTopic`** directly on that document in MongoDB. The value should be lowercase with only `a–z`, `0–9`, `.`, `_`, `-` (max 249 characters); note that the next **edit** save in admin will overwrite it with the auto-derived topic again unless you only change data outside admin.

## 2. Create the topic

The producer uses `allowAutoTopicCreation: false`. Create the topic once:

```bash
docker exec new-marketing-redpanda rpk topic create marketing.events
```

List topics:

```bash
docker exec new-marketing-redpanda rpk topic list
```

### Delete topics (remove a topic and its messages)

Kafka does not support “empty this topic in place” the way a table truncate does. To **clear** data you usually **delete the topic** and **create it again** if the app still needs it.

Delete one topic:

```bash
docker exec new-marketing-redpanda rpk topic delete marketing.events
```

Delete several at once (e.g. base topic plus per-tenant topics):

```bash
docker exec new-marketing-redpanda rpk topic delete marketing.events marketing.events.acme_corp_db
```

After deleting, run **`rpk topic create …`** again for any topic the producer must use (`allowAutoTopicCreation` is off in this app).

### Total clear (delete **all** topics at once)

For a **full local reset**—no topics, no messages, clean broker—the reliable approach is to **recreate the Redpanda container**. This project’s `docker-compose.kafka.yml` does **not** persist Redpanda data on the host, so broker state lives **inside** the container; when the container is removed, **everything** (every topic) is gone.

From the `new-marketing` directory:

```bash
docker compose -f docker-compose.kafka.yml down
docker compose -f docker-compose.kafka.yml up -d
```

If you ever add **named volumes** to that compose file, use **`down -v`** so those volumes are removed too:

```bash
docker compose -f docker-compose.kafka.yml down -v
docker compose -f docker-compose.kafka.yml up -d
```

Wait a few seconds for Redpanda to be ready, then recreate at least the base topic:

```bash
docker exec new-marketing-redpanda rpk topic create marketing.events
```

Per-tenant topics will appear again when the app (or admin flows) **ensures** them, or you can create them manually as needed.

## 3. Configure the app

Add to `.env` or `.env.local` (gitignored patterns apply):

```bash
KAFKA_BROKERS=127.0.0.1:19092
KAFKA_SSL=false
KAFKA_TOPIC_MARKETING_EVENTS=marketing.events
```

Leave **`KAFKA_USERNAME`** and **`KAFKA_PASSWORD`** empty for local plaintext.

Restart the dev server after changing env:

```bash
npm run dev
```

## 4. Watch events

### Redpanda Console (browser)

Open [http://localhost:8080](http://localhost:8080) → **Topics** → `marketing.events` → **Messages** (live tail).

### CLI (streams until Ctrl+C)

New messages only (tail from end):

```bash
docker exec -it new-marketing-redpanda rpk topic consume marketing.events -o :end -f '%v\n'
```

## 5. Producing events

Send a draft campaign from the **campaigns** list (paper plane). When the email **worker** finishes all batches, the app publishes **`campaign.send.completed`** to the configured topic.

## Troubleshooting

- **Connection refused** — Compose is up, `KAFKA_BROKERS=127.0.0.1:19092`, firewall not blocking 19092.
- **Unknown topic** — Run `rpk topic create marketing.events`.
- **Console empty** — Complete a campaign send and wait until processing finishes; confirm topic name matches `KAFKA_TOPIC_MARKETING_EVENTS`.
- **Reset or remove topics** — See **Delete topics** (pick topics) or **Total clear** (wipe everything) under **Create the topic**.
- **Port 8080 in use** — Change the host port in `docker-compose.kafka.yml` under `console.ports`.

## Production (GCP)

For **Google Cloud Managed Service for Apache Kafka**, use TLS and SASL per [Google’s SASL guide](https://cloud.google.com/managed-service-for-apache-kafka/docs/authentication-kafka).

### Option A: SA vitals in .env (no JSON file)

Put the service account key fields directly in `.env`:

```bash
KAFKA_BROKERS=bootstrap.CLUSTER_ID.REGION.managedkafka.PROJECT_ID.cloud.goog:9092
KAFKA_SSL=true
KAFKA_TOPIC_MARKETING_EVENTS=marketing.events
KAFKA_SA_CLIENT_EMAIL=your-sa@PROJECT_ID.iam.gserviceaccount.com
KAFKA_SA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
KAFKA_SA_PROJECT_ID=your-gcp-project-id
```

`KAFKA_SA_PRIVATE_KEY` can use literal `\n` for newlines; the app converts them.

### Option B: Base64 of full JSON

Use `KAFKA_USERNAME` (SA email) and `KAFKA_PASSWORD` (base64 of the entire SA key JSON, single line).
