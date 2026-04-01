import type { HydratedDocument } from 'mongoose'
import type { ContactTypeDoc } from '../../models/tenant/ContactType'

export type ContactTypeModel = HydratedDocument<ContactTypeDoc>
