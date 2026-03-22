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

## 2. Create the topic

The producer uses `allowAutoTopicCreation: false`. Create the topic once:

```bash
docker exec new-marketing-redpanda rpk topic create marketing.events
```

List topics:

```bash
docker exec new-marketing-redpanda rpk topic list
```

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
- **Port 8080 in use** — Change the host port in `docker-compose.kafka.yml` under `console.ports`.

## Production (GCP)

For **Google Cloud Managed Service for Apache Kafka**, use TLS and SASL per [Google’s SASL guide](https://cloud.google.com/managed-service-for-apache-kafka/docs/authentication-kafka). See `nuxt.config.ts` `runtimeConfig` comments for env variable names.
