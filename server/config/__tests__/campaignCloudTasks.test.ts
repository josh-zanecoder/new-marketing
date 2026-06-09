import { afterEach, describe, expect, it } from 'vitest'
import {
  getCampaignCloudTasksClientAuth,
  resolveCampaignCloudTasksAuth
} from '../campaignCloudTasks'

const ENV_KEYS = [
  'CLOUD_TASKS_KEY_FILENAME',
  'CLOUD_TASKS_CLIENT_EMAIL',
  'CLOUD_TASKS_PRIVATE_KEY',
  'GCP_CLIENT_EMAIL',
  'GCP_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY'
] as const

const saved: Record<string, string | undefined> = {}

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

function stashEnv() {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
}

describe('campaignCloudTasks auth', () => {
  it('prefers CLOUD_TASKS_CLIENT_EMAIL over GCP and Firebase', () => {
    stashEnv()
    process.env.CLOUD_TASKS_CLIENT_EMAIL = 'tasks@poc-1-aima-pmu.iam.gserviceaccount.com'
    process.env.CLOUD_TASKS_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----'
    process.env.FIREBASE_CLIENT_EMAIL = 'firebase-adminsdk@other.iam.gserviceaccount.com'
    process.env.FIREBASE_PRIVATE_KEY = 'firebase-key'

    const resolved = resolveCampaignCloudTasksAuth()
    expect(resolved.mode).toBe('explicit_credentials')
    expect(resolved.principal).toBe('tasks@poc-1-aima-pmu.iam.gserviceaccount.com')
  })

  it('does not use Firebase credentials as Cloud Tasks fallback', () => {
    stashEnv()
    process.env.FIREBASE_CLIENT_EMAIL = 'firebase-adminsdk@other.iam.gserviceaccount.com'
    process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----'

    const auth = getCampaignCloudTasksClientAuth()
    expect(auth.credentials).toBeUndefined()
    expect(resolveCampaignCloudTasksAuth().mode).toBe('application_default')
  })

  it('uses GCP_CLIENT_EMAIL when set without Firebase', () => {
    stashEnv()
    process.env.GCP_CLIENT_EMAIL = 'run@poc-1-aima-pmu.iam.gserviceaccount.com'
    process.env.GCP_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----'

    const resolved = resolveCampaignCloudTasksAuth()
    expect(resolved.mode).toBe('explicit_credentials')
    expect(resolved.principal).toBe('run@poc-1-aima-pmu.iam.gserviceaccount.com')
  })
})
