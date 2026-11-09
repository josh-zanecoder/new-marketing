# Schedule → cancel → schedule again (Cloud Tasks)

## Symptom

After a successful **Schedule**, **Cancel** from the campaign list works (campaign returns to Draft), but **Schedule send** again returns:

- UI: `Failed to schedule send. Try again.`
- HTTP: `POST /api/v1/tenant/send-campaign/schedule` → **503**

## Root cause

Cloud Tasks **remembers deleted task names** for hours (deduplication / tombstone window — up to ~24h).  
Marketing previously used a **fixed** task id:

`cs-schedule-{dbName}-{campaignId}`

Flow that broke:

1. Schedule → create task with fixed id  
2. Cancel → delete that task (name enters tombstone window)  
3. Schedule again → create **same** id → `ALREADY_EXISTS`  
4. Replace path deleted (NOT_FOUND on tombstone) then create again → still `ALREADY_EXISTS`  
5. API catch → 503 `Failed to schedule send. Try again.`

This is **not** “previous schedule state left in Mongo” — cancel correctly sets Draft and clears `scheduledAt`. The blocker is the Cloud Tasks name reuse policy.

## Fix

- Mint a **unique** Cloud Tasks id per schedule enqueue:  
  `cs-schedule-{db}-{campaignId}-{uuid}`  
  (`server/utils/campaignSend/campaignScheduleCloudTaskId.ts`)
- Cancel still deletes the **legacy** fixed id (if present) and **lists** the queue to remove any unique-suffix schedule tasks for that campaign.
- Schedule failure cleanup no longer fails the request if secondary Cloud Tasks cleanup throws.

## Ops / logs

On `marketing-v2-dev` / `marketing-test`, look for:

```text
[ScheduleCampaign] enqueue
[CampaignCloudTasks] enqueue.schedule.failed
[CampaignCloudTasks] enqueue.schedule.duplicate
[CampaignCloudTasks] enqueue.schedule.replaceCreate.failed
```

Before the fix, cancel→reschedule often showed `ALREADY_EXISTS` / replaceCreate.failed. After the fix, each enqueue should log `enqueue.schedule` with a **new** `taskId` suffix.

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="marketing-v2-dev" AND (textPayload:"ScheduleCampaign" OR textPayload:"CampaignCloudTasks")' \
  --project=poc-1-aima-pmu \
  --freshness=1d \
  --limit=50
```

(Adjust service name / project if your deploy uses different ids.)

## Tests

```bash
npm run test -- server/utils/campaignSend/__tests__/campaignScheduleCloudTaskId.test.ts
```
