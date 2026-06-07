import { describe, expect, it } from 'vitest'
import { buildOwnerMetadataMongoSet } from '../contactOwnerMetadata'

describe('buildOwnerMetadataMongoSet', () => {
  it('maps owner fields to metadata dot paths', () => {
    expect(
      buildOwnerMetadataMongoSet({
        ownerId: 'user-1',
        ownerEmail: 'Owner@Example.com',
        ownerFirstName: ' Jane ',
        ownerLastName: ' Doe ',
        ownerAvatarUrl: ' https://cdn.example.com/a.png ',
        ownerPhone: ' 555-0100 '
      })
    ).toEqual({
      'metadata.ownerId': 'user-1',
      'metadata.ownerEmail': 'owner@example.com',
      'metadata.ownerFirstName': 'Jane',
      'metadata.ownerLastName': 'Doe',
      'metadata.ownerAvatarUrl': 'https://cdn.example.com/a.png',
      'metadata.ownerPhone': '555-0100'
    })
  })
})
