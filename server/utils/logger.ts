import { createConsola } from 'consola'

/** Server-side logger (structured tags for grep). */
export const logger = createConsola({
  defaults: { tag: 'new-marketing' }
}).withTag('kafka')
