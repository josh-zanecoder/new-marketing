export function unsubscribeResultPayload(params: {
  ok: boolean
  title: string
  message: string
  email?: string
  marketing?: boolean
  preview?: boolean
  reason?: string
}) {
  return {
    ok: params.ok,
    title: params.title,
    message: params.message,
    ...(params.email !== undefined ? { email: params.email } : {}),
    ...(params.marketing !== undefined ? { marketing: params.marketing } : {}),
    ...(params.preview ? { preview: true } : {}),
    ...(params.reason ? { reason: params.reason } : {})
  }
}

export function unsubscribePreviewHtml(params: {
  token: string
  emailMasked: string
  marketingSubscribed: boolean
  errorTitle?: string
  errorMessage?: string
}): string {
  if (params.errorTitle) {
    return unsubscribeStatusHtml(params.errorTitle, params.errorMessage ?? '', false)
  }

  const yesChecked = params.marketingSubscribed ? 'checked' : ''
  const noChecked = params.marketingSubscribed ? '' : 'checked'
  const tokenEsc = escapeHtml(params.token)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Email preferences</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f8fafc; color: #0f172a; padding: 1.5rem; box-sizing: border-box; }
    .card { width: 100%; max-width: 28rem; padding: 2rem 2.25rem; background: #fff; border-radius: 1rem; box-shadow: 0 10px 40px rgba(15,23,42,.08); border: 1px solid #e2e8f0; }
    h1 { font-size: 1.25rem; margin: 0 0 .5rem; color: #0f172a; }
    .sub { margin: 0 0 1.25rem; color: #64748b; font-size: .9375rem; line-height: 1.5; }
    .email { font-weight: 600; color: #334155; }
    fieldset { border: 0; margin: 0 0 1.25rem; padding: 0; }
    legend { font-size: .8125rem; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: #64748b; margin-bottom: .75rem; }
    label { display: flex; align-items: center; gap: .5rem; margin-bottom: .5rem; font-size: .9375rem; color: #334155; cursor: pointer; }
    .confirm { display: flex; align-items: flex-start; gap: .5rem; margin: 1rem 0 1.25rem; font-size: .875rem; color: #475569; line-height: 1.45; }
    button { width: 100%; border: 0; border-radius: .75rem; padding: .75rem 1rem; font-size: .9375rem; font-weight: 600; color: #fff; background: #0c2340; cursor: pointer; }
    button:disabled { opacity: .45; cursor: not-allowed; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Email preferences</h1>
    <p class="sub">Update marketing email preferences for <span class="email">${escapeHtml(params.emailMasked)}</span>.</p>
    <form method="post" action="/api/v1/unsubscribe" id="prefs-form">
      <input type="hidden" name="token" value="${tokenEsc}" />
      <fieldset>
        <legend>Marketing emails</legend>
        <label><input type="radio" name="marketing" value="true" ${yesChecked} required /> Yes, keep sending marketing emails</label>
        <label><input type="radio" name="marketing" value="false" ${noChecked} required /> No, unsubscribe from marketing emails</label>
      </fieldset>
      <label class="confirm">
        <input type="checkbox" id="confirm" name="confirm" value="true" required />
        <span>I confirm I want to update my email preferences.</span>
      </label>
      <button type="submit" id="submit-btn" disabled>Save preferences</button>
    </form>
  </div>
  <script>
    const confirm = document.getElementById('confirm');
    const submitBtn = document.getElementById('submit-btn');
    confirm.addEventListener('change', () => { submitBtn.disabled = !confirm.checked; });
  </script>
</body>
</html>`
}

export function unsubscribeStatusHtml(title: string, message: string, ok: boolean): string {
  const accent = ok ? '#059669' : '#b45309'
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f8fafc; color: #0f172a; }
    .card { max-width: 28rem; padding: 2rem 2.25rem; background: #fff; border-radius: 1rem; box-shadow: 0 10px 40px rgba(15,23,42,.08); border: 1px solid #e2e8f0; text-align: center; }
    h1 { font-size: 1.25rem; margin: 0 0 .75rem; color: ${accent}; }
    p { margin: 0; line-height: 1.55; color: #475569; font-size: .9375rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
