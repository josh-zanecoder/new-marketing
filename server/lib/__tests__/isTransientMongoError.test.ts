import { describe, expect, it } from 'vitest'
import { isClosedMongoTopologyError, isTransientMongoError } from '../mongoose'

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
