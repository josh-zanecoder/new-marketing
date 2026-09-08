<template>
  <section class="rf-tab-shell">
    <div class="rf-tab-intro">
      <div class="rf-tab-intro__badge rf-tab-intro__badge--blue">Bulk Unsubscribe</div>
      <h2 class="rf-tab-intro__title">Unsubscribe contacts from Excel</h2>
      <p class="rf-tab-intro__text">
        Upload a spreadsheet with an <strong>Email</strong> column. Matching contacts in this
        tenant are marked unsubscribed and removed from recipient lists (same as the contact
        toggle).
      </p>
    </div>

    <div class="rf-tab-content">
      <slot />
    </div>
  </section>
</template>
