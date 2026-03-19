<script setup lang="ts">
definePageMeta({
  layout: false
})

const DEFAULT_EMAIL_TEMPLATE = `
<table class="email-wrapper" style="width:100%;background:linear-gradient(135deg,#f8f4ef 0%,#f0e8df 100%);padding:32px 16px;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;">
  <tr><td align="center" style="padding:0;">
    <table class="email-container" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(63,38,16,0.08);">
      <tr>
        <td class="header" style="background:linear-gradient(90deg,#2d2a26 0%,#3d3834 100%);padding:28px 40px;text-align:center;">
          <table style="width:100%;"><tr><td style="font-size:22px;font-weight:600;color:#fffdfb;letter-spacing:0.5px;">Your Brand</td></tr><tr><td style="font-size:12px;color:rgba(255,253,251,0.7);padding-top:4px;">Newsletter</td></tr></table>
        </td>
      </tr>
      <tr>
        <td class="hero" style="padding:48px 40px 40px;text-align:center;background:#fffdfb;">
          <h1 style="margin:0 0 16px;font-size:28px;font-weight:700;color:#2d2a26;line-height:1.3;">Welcome to Our Newsletter</h1>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#5c5349;">Discover tips, updates, and exclusive content delivered straight to your inbox.</p>
          <a href="#" class="cta-btn" style="display:inline-block;padding:14px 32px;background:#2d2a26;color:#fffdfb;text-decoration:none;font-size:14px;font-weight:600;border-radius:8px;">Get Started</a>
        </td>
      </tr>
      <tr>
        <td class="divider" style="height:1px;background:#f0e1d4;padding:0;"></td>
      </tr>
      <tr>
        <td class="content" style="padding:40px;">
          <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#2d2a26;">What to expect</h2>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#5c5349;">• Weekly insights and industry updates</p>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#5c5349;">• Exclusive offers and early access</p>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#5c5349;">• Tips to help you succeed</p>
        </td>
      </tr>
      <tr>
        <td class="footer" style="background:#f8f4ef;padding:24px 40px;text-align:center;">
          <p style="margin:0 0 8px;font-size:12px;color:#8a7f73;">© 2025 Your Brand. All rights reserved.</p>
          <p style="margin:0;font-size:11px;color:#a89f95;"><a href="#" style="color:#8a7f73;">Unsubscribe</a> · <a href="#" style="color:#8a7f73;">Preferences</a></p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
<style>.email-wrapper{width:100%;min-height:100vh;}.cta-btn:hover{background:#3d3834 !important;}</style>
`

const route = useRoute()
const editorContainerRef = ref<HTMLDivElement | null>(null)
const editorRef = ref<any>(null)
const initialHtml = ref<string | null>(null)
const htmlReady = ref(false)
const isMounted = ref(false)

const htmlFromUrl = computed(() => route.query.html as string)
const builderId = computed(() => route.query.builderId as string)
const campaignId = computed(() => route.query.campaignId as string)
const token = computed(() => route.query.token as string)

onMounted(() => {
  isMounted.value = true
})

watch([isMounted, htmlFromUrl, builderId, campaignId], () => {
  if (!isMounted.value) return

  let resolved: string | null = null

  if (htmlFromUrl.value) {
    try {
      resolved = decodeURIComponent(htmlFromUrl.value)
    } catch {}
  }

  if (!resolved && builderId.value && typeof window !== 'undefined') {
    try {
      const stored = window.sessionStorage.getItem(builderId.value)
      if (stored) {
        resolved = stored
        window.sessionStorage.removeItem(builderId.value)
      }
    } catch {}
  }

  if (!resolved && campaignId.value && typeof window !== 'undefined') {
    try {
      const stored = window.sessionStorage.getItem(`campaign-template-${campaignId.value}`)
      if (stored) resolved = stored
    } catch {}
  }

  initialHtml.value = resolved
  htmlReady.value = true
}, { immediate: true })

watch([isMounted, htmlReady], () => {
  if (!isMounted.value || !htmlReady.value) return

  nextTick().then(() => {
    if (!editorContainerRef.value) return

  Promise.all([
    import('grapesjs'),
    import('grapesjs-preset-newsletter')
  ]).then(([grapesjsModule, presetModule]) => {
    const grapesjs = grapesjsModule.default
    const presetNewsletter = presetModule.default

    if (!editorContainerRef.value) return

    const editor = grapesjs.init({
      height: '100%',
      storageManager: false,
      container: editorContainerRef.value,
      fromElement: false,
      noticeOnUnload: false,
      plugins: [
        (editorInstance: any) =>
          presetNewsletter(editorInstance, {
            modalLabelImport: 'Paste all your code here below and click import',
            modalLabelExport: 'Copy the code and use it wherever you want',
            importPlaceholder: '<table class="table"><tr><td class="cell">Hello world!</td></tr></table>',
            cellStyle: {
              'font-size': '12px',
              'font-weight': '300',
              'vertical-align': 'top',
              color: 'rgb(111, 119, 125)',
              margin: '0',
              padding: '0'
            },
            inlineCss: true,
            updateStyleManager: true,
            showStylesOnChange: true,
            showBlocksOnLoad: true,
            useCustomTheme: true,
            textCleanCanvas: 'Are you sure you want to clear the canvas?'
          })
      ]
    })

    editor.Commands.add('save-and-exit', {
      run: () => {
        try {
          const html = editor.getHtml()
          const css = editor.getCss()
          const fullHtml = `<style>${css}</style>${html}`
          let targetId = campaignId.value
          if (typeof window !== 'undefined') {
            if (campaignId.value) {
              window.sessionStorage.setItem(`campaign-template-${campaignId.value}`, fullHtml)
            } else if (builderId.value) {
              targetId = `temp-${Date.now()}`
              window.sessionStorage.setItem(`campaign-template-${targetId}`, fullHtml)
              window.sessionStorage.setItem('mortdash-pending-campaign', JSON.stringify({
                form: { name: '', senderName: '', senderEmail: '', subject: '', recipientsMode: 'list', recipientsListId: '', recipientsManual: [''], templateMode: 'scratch', selectedTemplateId: '' },
                campaignId: targetId
              }))
            }
          }
          navigateTo(targetId ? `/client/campaigns/add?campaignId=${targetId}&fromEditor=1` : '/client/campaigns')
        } catch {}
      }
    })

    editor.Commands.add('save-to-device', {
      run: () => {
        try {
          const html = editor.getHtml()
          const css = editor.getCss()
          const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Template</title>
  <style>${css}</style>
</head>
<body>
${html}
</body>
</html>`
          const blob = new Blob([fullHtml], { type: 'text/html' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `email-template-${Date.now()}.html`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
        } catch {}
      }
    })

    editor.onReady(() => {
      const panels = editor.Panels
      const optionsPanel = panels.getPanel('options')
      if (optionsPanel) {
        panels.addButton('options', {
          id: 'save-to-device',
          label: '<svg style="display:block;max-width:22px" viewBox="0 0 24 24"><path fill="currentColor" d="M5,20H19V18H5M19,11H15V17H9V11H5L12,4L19,11Z"/></svg>',
          command: 'save-to-device',
          attributes: { title: 'Save to Device' }
        })
      }
      if (initialHtml.value) {
        try {
          editor.runCommand('core:canvas-clear')
          const html = initialHtml.value
          setTimeout(() => {
            editor.addComponents(html)
          }, 300)
        } catch {
          editor.addComponents(DEFAULT_EMAIL_TEMPLATE)
        }
      } else {
        editor.addComponents(DEFAULT_EMAIL_TEMPLATE)
      }
    })

    editorRef.value = editor
  }).catch(console.error)
  })

  return () => {
    if (editorRef.value) {
      editorRef.value.destroy()
      editorRef.value = null
    }
  }
}, { immediate: true })

onBeforeUnmount(() => {
  if (editorRef.value) {
    editorRef.value.destroy()
    editorRef.value = null
  }
})

function handleSaveAndExit() {
  if (!editorRef.value) return
  try {
    const html = editorRef.value.getHtml()
    const css = editorRef.value.getCss()
    const fullHtml = `<style>${css}</style>${html}`
    let targetId = campaignId.value
    if (typeof window !== 'undefined') {
      if (campaignId.value) {
        window.sessionStorage.setItem(`campaign-template-${campaignId.value}`, fullHtml)
      } else if (builderId.value) {
        targetId = `temp-${Date.now()}`
        window.sessionStorage.setItem(`campaign-template-${targetId}`, fullHtml)
        window.sessionStorage.setItem('mortdash-pending-campaign', JSON.stringify({
          form: { name: '', senderName: '', senderEmail: '', subject: '', recipientsMode: 'list', recipientsListId: '', recipientsManual: [''], templateMode: 'scratch', selectedTemplateId: '' },
          campaignId: targetId
        }))
      }
    }
    navigateTo(targetId ? `/client/campaigns/add?campaignId=${targetId}&fromEditor=1` : '/client/campaigns')
  } catch {}
}
</script>

<template>
  <ClientOnly>
    <div v-if="!isMounted" class="flex h-screen items-center justify-center bg-slate-100">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
    </div>
    <div v-else class="flex h-screen flex-col overflow-hidden">
      <div class="flex shrink-0 items-center justify-end border-b border-slate-200 bg-slate-800 px-4 py-2.5">
        <button
          type="button"
          class="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
          @click="handleSaveAndExit"
        >
          Save and exit
        </button>
      </div>
      <div
        ref="editorContainerRef"
        class="min-h-0 flex-1 overflow-hidden"
        style="height: calc(100vh - 52px)"
      />
    </div>
    <template #fallback>
      <div class="flex h-screen items-center justify-center bg-slate-100">
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
      </div>
    </template>
  </ClientOnly>
</template>
