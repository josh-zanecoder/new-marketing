export type ContactOwnerFields = {
  ownerId: string
  ownerEmail: string
  ownerFirstName: string
  ownerLastName: string
  ownerAvatarUrl: string
  ownerPhone: string
}

export function readOwnerFieldsFromMetadata(
  metadata: Record<string, unknown>
): ContactOwnerFields {
  return {
    ownerId: typeof metadata.ownerId === 'string' ? metadata.ownerId : '',
    ownerEmail: typeof metadata.ownerEmail === 'string' ? metadata.ownerEmail : '',
    ownerFirstName:
      typeof metadata.ownerFirstName === 'string' ? metadata.ownerFirstName.trim() : '',
    ownerLastName: typeof metadata.ownerLastName === 'string' ? metadata.ownerLastName.trim() : '',
    ownerAvatarUrl:
      typeof metadata.ownerAvatarUrl === 'string' ? metadata.ownerAvatarUrl.trim() : '',
    ownerPhone: typeof metadata.ownerPhone === 'string' ? metadata.ownerPhone.trim() : ''
  }
}

/** Non-empty owner fields for nested `metadata` on contact upserts. */
export function ownerFieldsForContactMetadata(
  metadata: Record<string, unknown>
): Partial<ContactOwnerFields> {
  const owner = readOwnerFieldsFromMetadata(metadata)
  return {
    ...(owner.ownerId ? { ownerId: owner.ownerId } : {}),
    ...(owner.ownerEmail ? { ownerEmail: owner.ownerEmail } : {}),
    ...(owner.ownerFirstName ? { ownerFirstName: owner.ownerFirstName } : {}),
    ...(owner.ownerLastName ? { ownerLastName: owner.ownerLastName } : {}),
    ...(owner.ownerAvatarUrl ? { ownerAvatarUrl: owner.ownerAvatarUrl } : {}),
    ...(owner.ownerPhone ? { ownerPhone: owner.ownerPhone } : {})
  }
}

/** Dot-path $set for owner metadata without replacing unrelated metadata keys. */
export function buildOwnerMetadataMongoSet(
  owner: ContactOwnerFields
): Record<string, string> {
  return {
    'metadata.ownerId': String(owner.ownerId ?? '').trim(),
    'metadata.ownerEmail': String(owner.ownerEmail ?? '')
      .trim()
      .toLowerCase(),
    'metadata.ownerFirstName': String(owner.ownerFirstName ?? '').trim(),
    'metadata.ownerLastName': String(owner.ownerLastName ?? '').trim(),
    'metadata.ownerAvatarUrl': String(owner.ownerAvatarUrl ?? '').trim(),
    'metadata.ownerPhone': String(owner.ownerPhone ?? '').trim()
  }
}
