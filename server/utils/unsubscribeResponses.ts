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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Email preferences</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f8fafc; color: #0f172a; padding: 1.5rem; box-sizing: border-box; }
    .card { width: 100%; max-width: 28rem; padding: 2rem; background: #fff; border-radius: 1rem; box-shadow: 0 10px 40px rgba(15,23,42,.08); border: 1px solid #e2e8f0; }
    h1 { font-size: 1.25rem; margin: 0 0 .5rem; }
    .lead { margin: 0 0 1.25rem; line-height: 1.55; color: #475569; font-size: .9375rem; }
    fieldset { border: 0; margin: 0 0 1rem; padding: 0; }
    legend { font-size: .6875rem; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #64748b; margin-bottom: .75rem; }
    label.option { display: flex; align-items: center; gap: .75rem; padding: .75rem 1rem; border: 1px solid #e2e8f0; border-radius: .75rem; margin-bottom: .5rem; cursor: pointer; font-size: .875rem; }
    label.confirm { display: flex; align-items: flex-start; gap: .75rem; font-size: .875rem; color: #475569; margin-bottom: 1rem; line-height: 1.5; }
    button { width: 100%; border: 0; border-radius: .75rem; padding: .75rem 1rem; font-size: .875rem; font-weight: 600; color: #fff; background: #0c2340; cursor: pointer; }
    button:hover { background: #0a1c33; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Email preferences</h1>
    <p class="lead">Update marketing email preferences for <strong>${escapeHtml(params.emailMasked)}</strong>.</p>
    <form method="post" action="/api/v1/unsubscribe" id="prefs-form">
      <input type="hidden" name="token" value="${escapeHtml(params.token)}" />
      <fieldset>
        <legend>Marketing emails</legend>
        <label class="option"><input type="radio" name="marketing" value="true" ${yesChecked} required /> Yes, keep sending marketing emails</label>
        <label class="option"><input type="radio" name="marketing" value="false" ${noChecked} required /> No, unsubscribe from marketing emails</label>
      </fieldset>
      <label class="confirm">
        <input type="checkbox" name="confirm" value="true" required />
        <span>I confirm I want to update my email preferences.</span>
      </label>
      <button type="submit">Save preferences</button>
    </form>
  </div>
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
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f8fafc; color: #0f172a; padding: 1.5rem; }
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

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
