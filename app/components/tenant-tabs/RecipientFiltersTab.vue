<template>
  <section class="rf-tab-shell">
    <div class="rf-tab-intro">
      <div class="rf-tab-intro__badge rf-tab-intro__badge--indigo">Recipient Rules</div>
      <h2 class="rf-tab-intro__title">Build and manage recipient filters</h2>
      <p class="rf-tab-intro__text">
        Each row is stored by <strong>tenant ID</strong>. Set a <strong>contact type</strong>, then optionally add a
        <strong>property</strong>. For <strong>Address</strong> or <strong>Contact profile</strong>, pick a
        <strong>property type</strong> (e.g. state vs city, or type vs sub type), then enter
        <strong>property values</strong>. State, Source, Contact profile and Partner accept several keys separated by
        commas or new lines; the other properties match one value exactly, punctuation included.
      </p>
    </div>

    <div class="rf-subtabs">
      <button
        type="button"
        class="rf-subtabs__btn"
        :class="{ 'rf-subtabs__btn--active': activeTab === 'contactTypes' }"
        @click="activeTab = 'contactTypes'"
      >
        Contact Types
      </button>
      <button
        type="button"
        class="rf-subtabs__btn"
        :class="{ 'rf-subtabs__btn--active': activeTab === 'recipientFilters' }"
        @click="activeTab = 'recipientFilters'"
      >
        Recipient Filters
      </button>
    </div>

    <div v-show="activeTab === 'contactTypes'" class="rf-tab-content">
      <slot name="contact-types" />
    </div>

    <div v-show="activeTab === 'recipientFilters'" class="rf-tab-content">
      <slot name="recipient-filters" />
    </div>
  </section>
</template>

<script setup lang="ts">
const activeTab = ref<'contactTypes' | 'recipientFilters'>('recipientFilters')
</script>
