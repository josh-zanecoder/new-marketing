<template>
  <article class="rf-record-card">
    <header v-if="$slots.header || $slots.status" class="rf-record-card__header">
      <div class="rf-record-card__heading min-w-0">
        <slot name="header" />
      </div>
      <div v-if="$slots.status" class="rf-record-card__status shrink-0">
        <slot name="status" />
      </div>
    </header>

    <dl v-if="$slots.default" class="rf-record-card__fields">
      <slot />
    </dl>

    <footer v-if="$slots.actions" class="rf-record-card__actions">
      <slot name="actions" />
    </footer>
  </article>
</template>
