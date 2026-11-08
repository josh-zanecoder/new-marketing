import type { Model, Types } from 'mongoose'

export interface EmailTemplateDoc {
  _id: Types.ObjectId
  name: string
  subject?: string
  description?: string
  /** Current schema field */
  htmlTemplate?: string
  htmlSource?: 'editor' | 'upload' | 'custom'
  /** Listed under Saved templates in the design modal when true (default). */
  saveToLibrary?: boolean
  externalId?: string
  categoryId?: Types.ObjectId | null
  /** Soft-delete timestamp; null = active. */
  deletedAt?: Date | null
  /** `ownerEmail` set = private to that owner; empty = shared with the tenant. */
  metadata?: { ownerEmail?: string }
  createdBy?: string
  /**
   * LO recipient-lists flag path: pending_approval | approved | rejected.
   * Omitted/legacy → treat as approved when flag is ON.
   */
  approvalStatus?: 'pending_approval' | 'approved' | 'rejected'
  approvalSubmittedAt?: Date | null
  approvalReviewedAt?: Date | null
  approvalReviewedBy?: string
  approvalRejectionReason?: string
  /** Legacy field */
  html?: string
  clientId?: string
  css?: string
  createdAt?: Date
  updatedAt?: Date
}

export type EmailTemplateModel = Model<EmailTemplateDoc>
