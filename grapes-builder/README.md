# Grapes email builder (in-Marketing)

Static GrapesJS app built into `public/grapes-builder/` and loaded in an iframe from
`/tenant/grapes-builder`. Same crash isolation as a separate app, but shipped inside
Marketing (same pattern as in-repo workers: one codebase, isolated runtime surface).

```bash
# one-shot build into public/
npm run build:grapes

# rebuild on change while developing the builder UI
npm run dev:grapes
```

`npm run build` / `npm run postinstall` also build this so deploys and fresh installs
serve `/grapes-builder/` without a second Cloud Run service.

Optional overrides (rare): tenant `grapesBuilderUrl` or `NUXT_PUBLIC_GRAPES_BUILDER_URL`
still win when set; leave blank to use the in-app `/grapes-builder/`.
