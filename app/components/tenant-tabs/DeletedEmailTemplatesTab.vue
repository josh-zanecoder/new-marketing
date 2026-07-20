<template>
  <section class="rf-tab-shell">
    <div class="rf-tab-intro">
      <div class="rf-tab-intro__badge rf-tab-intro__badge--blue">Deleted Templates</div>
      <h2 class="rf-tab-intro__title">Soft-deleted email templates</h2>
      <p class="rf-tab-intro__text">
        Templates removed from the tenant library appear here. Recover restores them to the library;
        delete forever removes them from the database (campaigns that still linked a template will lose that link).
      </p>
    </div>

    <div class="rf-tab-content">
      <slot />
    </div>
  </section>
</template>
