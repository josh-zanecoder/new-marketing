import mongoose from 'mongoose'
import { getTenantClientModels } from '../../../../models/tenant/tenantClientModels'
import { isRegisteredTenantAuthContext } from '../../../../tenant/registry-auth'
import { getTenantConnectionFromEvent } from '../../../../tenant/connection'
import { normalizeRecipientListDoc } from '../../../../utils/recipientListDocument'

const MAX_PAGE_SIZE = 100
type RecipientListDoc = {
  _id: mongoose.Types.ObjectId
  name?: string
  listType?: string
  createdAt?: Date | null
  updatedAt?: Date | null
} & Record<string, unknown>

type RecipientListMemberRow = {
  contactId?: mongoose.Types.ObjectId | null
}

type ContactRow = {
  _id: mongoose.Types.ObjectId
  name?: string
  email?: string
  phone?: string | null
  contactKind?: string
  company?: string | null
  channel?: string | null
  source?: string | null
  address?: Record<string, unknown> | null
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Tenant access required' })
  }

  const rawId = getRouterParam(event, 'id')
  if (!rawId || !mongoose.isValidObjectId(rawId)) {
    throw createError({ statusCode: 400, message: 'Invalid list id' })
  }

  const listId = new mongoose.Types.ObjectId(rawId)

  const tenantConn = await getTenantConnectionFromEvent(event)
  const { RecipientList, RecipientListMember, Contact } =
    getTenantClientModels(tenantConn)

  const doc = (await RecipientList.findById(listId).lean().exec()) as RecipientListDoc | null
  if (!doc) {
    throw createError({ statusCode: 404, message: 'List not found' })
  }

  const { audience, filters, filterMode } = normalizeRecipientListDoc(doc)

  const query = getQuery(event)
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1)
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(String(query.limit ?? '50'), 10) || 50)
  )
  const skip = (page - 1) * pageSize

  const memberTotal = await RecipientListMember.countDocuments({
    recipientListId: listId
  })

  const memberRows = (await RecipientListMember.find({ recipientListId: listId })
    .select('contactId')
    .sort({ createdAt: 1 })
    .skip(skip)
    .limit(pageSize)
    .lean()
    .exec()) as RecipientListMemberRow[]

  const contactIds = memberRows.map((m) => m.contactId).filter(Boolean)

  const contacts: ContactRow[] =
    contactIds.length === 0
      ? []
      : ((await Contact.find({
          _id: { $in: contactIds },
          deletedAt: null
        })
          .select({
            name: 1,
            email: 1,
            phone: 1,
            contactKind: 1,
            company: 1,
            channel: 1,
            source: 1,
            address: 1
          })
          .lean()
          .exec()) as ContactRow[])

  const byId = new Map(contacts.map((c) => [String(c._id), c]))
  const items = contactIds
    .map((cid) => byId.get(String(cid)))
    .filter(Boolean)
    .map((c) => ({
      id: String(c!._id),
      name: c!.name ?? '',
      email: c!.email ?? '',
      phone: c!.phone ?? '',
      contactKind: c!.contactKind ?? '',
      company: c!.company ?? '',
      channel: c!.channel ?? '',
      source: c!.source ?? '',
      address: c!.address ?? {}
    }))

  return {
    list: {
      id: String(doc._id),
      name: doc.name ?? '',
      listType: doc.listType ?? '',
      audience,
      filters,
      filterMode,
      createdAt: doc.createdAt?.toISOString?.() ?? null,
      updatedAt: doc.updatedAt?.toISOString?.() ?? null
    },
    members: {
      items,
      total: memberTotal,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(memberTotal / pageSize))
    }
  }
})
