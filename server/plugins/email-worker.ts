export default defineNitroPlugin(() => {
  if (process.env.EMAIL_WORKER_DISABLED === 'true') return
  import('../workers/emailWorker').then(({ startEmailWorker }) => startEmailWorker()).catch((err) => {
    console.error('[EmailWorker] Failed to start:', err)
  })
})
