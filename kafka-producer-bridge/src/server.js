const express = require("express");
const { Kafka, logLevel } = require("kafkajs");

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || 8080);
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN || "";
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "").split(",").map(v => v.trim()).filter(Boolean);
const KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID || "marketing-kafka-producer-bridge";
const KAFKA_USERNAME = process.env.KAFKA_USERNAME || "";
const KAFKA_PASSWORD = process.env.KAFKA_PASSWORD || "";
const KAFKA_SSL = String(process.env.KAFKA_SSL || "true") === "true";
const KAFKA_SASL_MECHANISM = (process.env.KAFKA_SASL_MECHANISM || "PLAIN").toLowerCase();
const DEFAULT_TOPIC = process.env.KAFKA_DEFAULT_TOPIC || "";

if (!KAFKA_BROKERS.length) throw new Error("KAFKA_BROKERS is required");
if (!KAFKA_USERNAME) throw new Error("KAFKA_USERNAME is required");
if (!KAFKA_PASSWORD) throw new Error("KAFKA_PASSWORD is required");

const kafka = new Kafka({
  clientId: KAFKA_CLIENT_ID,
  brokers: KAFKA_BROKERS,
  ssl: KAFKA_SSL,
  sasl: { mechanism: KAFKA_SASL_MECHANISM, username: KAFKA_USERNAME, password: KAFKA_PASSWORD },
  logLevel: logLevel.NOTHING
});

const producer = kafka.producer();
let producerReady = false;

async function ensureProducer() {
  if (producerReady) return;
  await producer.connect();
  producerReady = true;
}

function isAuthorized(req) {
  if (!BRIDGE_TOKEN) return true;
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return false;
  return auth.slice(7) === BRIDGE_TOKEN;
}

app.get("/health", async (_req, res) => {
  try {
    await ensureProducer();
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.log("health check failed", { error: error.message });
    return res.status(503).json({ ok: false, error: "producer_unavailable" });
  }
});

app.post("/publish", async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).json({ ok: false, error: "unauthorized" });
  const topic = req.body.topic || DEFAULT_TOPIC;
  const key = req.body.key ? String(req.body.key) : null;
  const value = req.body.value;
  const headers = req.body.headers && typeof req.body.headers === "object" ? req.body.headers : {};
  if (!topic) return res.status(400).json({ ok: false, error: "topic_required" });
  if (value === undefined || value === null) return res.status(400).json({ ok: false, error: "value_required" });
  try {
    await ensureProducer();
    const serializedHeaders = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, String(v)]));
    const payload = { topic, messages: [{ key, value: JSON.stringify(value), headers: serializedHeaders }] };
    const result = await producer.send(payload);
    return res.status(200).json({ ok: true, topic, result });
  } catch (error) {
    console.log("publish failed", { topic, error: error.message });
    return res.status(500).json({ ok: false, error: "publish_failed", message: error.message });
  }
});

app.listen(PORT, () => console.log(`bridge listening on ${PORT}`));

process.on("SIGTERM", async () => {
  try { await producer.disconnect(); } catch (_error) {}
  process.exit(0);
});
