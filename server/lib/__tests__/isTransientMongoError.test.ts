import { describe, expect, it } from 'vitest'
import {
  isClosedMongoTopologyError,
  isTransientMongoError,
  resolveMaxPoolSize
} from '../mongoose'

describe('isClosedMongoTopologyError', () => {
  it('matches a closed Mongo topology', () => {
    const err = new Error('Topology is closed')
    err.name = 'MongoTopologyClosedError'
    expect(isClosedMongoTopologyError(err)).toBe(true)
    expect(isTransientMongoError(err)).toBe(true)
  })

  it('does not treat unrelated errors as a closed topology', () => {
    expect(isClosedMongoTopologyError(new Error('duplicate key'))).toBe(false)
    expect(isTransientMongoError(new Error('duplicate key'))).toBe(false)
  })
})

describe('resolveMaxPoolSize', () => {
  it('defaults to 5 when unset or invalid', () => {
    expect(resolveMaxPoolSize(undefined)).toBe(5)
    expect(resolveMaxPoolSize('')).toBe(5)
    expect(resolveMaxPoolSize('0')).toBe(5)
    expect(resolveMaxPoolSize('abc')).toBe(5)
  })

  it('clamps to the hard cap of 50', () => {
    expect(resolveMaxPoolSize('10')).toBe(10)
    expect(resolveMaxPoolSize('50')).toBe(50)
    expect(resolveMaxPoolSize('100')).toBe(50)
  })
})
