<template>
  <section class="rf-tab-shell">
    <div class="rf-tab-intro">
      <div class="rf-tab-intro__badge rf-tab-intro__badge--blue">Deleted Flyers</div>
      <h2 class="rf-tab-intro__title">Soft-deleted Custom Flyers</h2>
      <p class="rf-tab-intro__text">
        Flyers removed from the tenant Custom Flyers library appear here. Recover restores them to the
        library; delete forever removes the Mongo row and the hosted file.
      </p>
    </div>

    <div class="rf-tab-content">
      <slot />
    </div>
  </section>
</template>
