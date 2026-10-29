<template>
  <section class="rf-tab-shell">
    <div class="rf-tab-intro">
      <div class="rf-tab-intro__badge rf-tab-intro__badge--blue">Bulk templates</div>
      <h2 class="rf-tab-intro__title">Upload email templates</h2>
      <p class="rf-tab-intro__text">
        Drop one or more <strong>.html</strong> files. They are saved to this tenant’s library
        as shared templates (<span class="font-mono">htmlSource: upload</span>).
      </p>
    </div>

    <div class="rf-tab-content">
      <slot />
    </div>
  </section>
</template>
