import { describe, expect, it } from 'vitest'
import { isDuplicateKeyOnlyBulkWriteError } from '../mongoose'

function bulkWriteError(codes: number[]) {
  const err = new Error('E11000 duplicate key error') as Error & {
    code: number
    writeErrors: Array<{ code: number }>
  }
  err.name = 'MongoBulkWriteError'
  err.code = codes[0] ?? 0
  err.writeErrors = codes.map((code) => ({ code }))
  return err
}

describe('isDuplicateKeyOnlyBulkWriteError', () => {
  it('matches unordered inserts where every failure is a duplicate key', () => {
    expect(isDuplicateKeyOnlyBulkWriteError(bulkWriteError([11000, 11000]))).toBe(true)
  })

  it('reads codes nested under writeError.err', () => {
    const err = Object.assign(new Error('dup'), { writeErrors: [{ err: { code: 11000 } }] })
    expect(isDuplicateKeyOnlyBulkWriteError(err)).toBe(true)
  })

  it('matches a single duplicate key error without writeErrors', () => {
    expect(isDuplicateKeyOnlyBulkWriteError(Object.assign(new Error('dup'), { code: 11000 }))).toBe(true)
  })

  it('rejects batches that also contain other write errors', () => {
    expect(isDuplicateKeyOnlyBulkWriteError(bulkWriteError([11000, 121]))).toBe(false)
  })

  it('rejects connection and unrelated errors', () => {
    expect(isDuplicateKeyOnlyBulkWriteError(new Error('Client must be connected before running operations'))).toBe(false)
    expect(isDuplicateKeyOnlyBulkWriteError(null)).toBe(false)
  })
})
