# Kafka UI (GCP)

Two Managed Kafka clusters are exposed via **Kafka UI** on `kafka-ui-vm` (`poc-1-aima-pmu`, `us-west1-a`).

| Environment | Cluster | Local URL | Tunnel script | VM port |
|-------------|---------|-----------|---------------|---------|
| Test / legacy | `convere-marketing-kafka` | http://localhost:8082 | `connect-kafka-ui-tunnel.sh` | 8082 |
| **Production** | `marketing-production-crm` | http://localhost:8083 | `connect-kafka-ui-tunnel-production.sh` | 8083 |

Production brokers match root `.env.production`:

`bootstrap.marketing-production-crm.us-west1.managedkafka.poc-1-aima-pmu.cloud.goog:9092`

## One-time: deploy production Kafka UI on the VM

From `new-marketing/kafka-ui` (requires `../.env.production` with `KAFKA_*` / `KAFKA_SA_*`):

```bash
chmod +x scripts/generate-env.sh connect-kafka-ui-tunnel-production.sh sync-production-to-vm.sh
./sync-production-to-vm.sh
```

This generates `kafka-ui/.env.production`, copies it to the VM, and runs **provectuslabs/kafka-ui** via `docker run` on host port **8083** (works on VMs without Docker Compose v2).

## Daily use (production)

```bash
./connect-kafka-ui-tunnel-production.sh
```

Open **http://localhost:8083** and select cluster **marketing-production-crm**.

## Regenerate local env only

```bash
./scripts/generate-env.sh ../.env.production
# or from GCP secret:
# gcloud secrets versions access latest --secret=marketing-production --project=poc-1-aima-pmu > /tmp/mp.env
# ./scripts/generate-env.sh /tmp/mp.env
```

## Test cluster (unchanged)

```bash
./connect-kafka-ui-tunnel.sh
# http://localhost:8082 — convere-marketing-kafka
```
