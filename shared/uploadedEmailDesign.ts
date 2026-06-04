/** Payload when applying uploaded HTML from the design modal. */
export type UploadedEmailDesignPayload = {
  html: string
  /** When true (default), HTML is listed under Saved templates after campaign save. */
  saveToLibrary: boolean
}
