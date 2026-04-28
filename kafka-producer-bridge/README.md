# Kafka Producer Bridge

Minimal HTTP to Kafka bridge for cross-project publishing.

## Endpoints
- `GET /health`
- `POST /publish`

`POST /publish` body:

```json
{
  "topic": "marketing.events.cbc_crm",
  "key": "tenant-uuid",
  "value": { "eventType": "contact.created", "payload": { "id": "123" } },
  "headers": { "x-tenant-id": "tenant-uuid" }
}
```

If `topic` is omitted, service uses `KAFKA_DEFAULT_TOPIC`.

## Environment variables
- `BRIDGE_TOKEN` optional bearer token for API auth
- `KAFKA_BROKERS` required, comma-separated brokers
- `KAFKA_CLIENT_ID` optional
- `KAFKA_USERNAME` required
- `KAFKA_PASSWORD` required
- `KAFKA_SSL` default `true`
- `KAFKA_SASL_MECHANISM` default `PLAIN`
- `KAFKA_DEFAULT_TOPIC` optional default topic

## Build image

```bash
gcloud builds submit \
  --project=poc-1-aima-pmu \
  --tag us-west1-docker.pkg.dev/poc-1-aima-pmu/app-images/marketing-kafka-producer-bridge:latest
```

## Deploy to Cloud Run (same VPC as Managed Kafka)

```bash
gcloud run deploy marketing-kafka-producer-bridge \
  --project=poc-1-aima-pmu \
  --region=us-west1 \
  --platform=managed \
  --image=us-west1-docker.pkg.dev/poc-1-aima-pmu/app-images/marketing-kafka-producer-bridge:latest \
  --allow-unauthenticated \
  --vpc-connector=projects/poc-1-aima-pmu/locations/us-west1/connectors/marketing-run-kafka \
  --vpc-egress=private-ranges-only \
  --set-env-vars=BRIDGE_TOKEN=replace-me,KAFKA_BROKERS=bootstrap.marketing.us-west1.managedkafka.poc-1-aima-pmu.cloud.goog:9092,KAFKA_CLIENT_ID=marketing-kafka-producer-bridge,KAFKA_USERNAME=gcp-apache-kafka@poc-1-aima-pmu.iam.gserviceaccount.com,KAFKA_PASSWORD=replace-base64,KAFKA_SSL=true,KAFKA_SASL_MECHANISM=PLAIN,KAFKA_DEFAULT_TOPIC=marketing.events.cbc_crm
```

## Call from mortdash service

```bash
curl -X POST "https://marketing-kafka-producer-bridge-<hash>-uw.a.run.app/publish" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer replace-me" \
  -d '{"key":"tenant-uuid","value":{"eventType":"contact.created","payload":{"id":"123"}}}'
```
