<script setup lang="ts">
definePageMeta({ layout: 'default' })

const {
  canReadFlyers,
  canAddFlyers,
  canDeleteFlyers,
  pending,
  uploadPending,
  uploadingFlyerName,
  addModalOpen,
  loadError,
  flyers,
  categories,
  flyerName,
  selectedCategoryId,
  pendingFlyerFileName,
  pendingFlyerContentType,
  pendingFlyerSizeLabel,
  pendingFlyerPreviewUrl,
  canSubmitFlyer,
  categoryFilter,
  categoryFilterOptions,
  categoryAssignOptions,
  categoryGroups,
  filteredFlyers,
  categoriesManagePath,
  setCategoryFilter,
  loadAll,
  openAddModal,
  closeAddModal,
  clearPendingFlyerFile,
  onFlyerFileChange,
  submitFlyerUpload,
  previewOpen,
  previewFlyer,
  openFlyerPreview,
  closeFlyerPreview,
  printFlyer,
  flyerToDelete,
  deleteModalMessage,
  deleteConfirmLoading,
  flyerDeleteConfirmTitle,
  flyerDeleteConfirmText,
  requestDeleteFlyer,
  cancelDeleteFlyer,
  confirmDeleteFlyer
} = useMarketingFlyersPage()

onMounted(() => {
  void loadAll()
})
</script>

<template>
  <div class="mx-auto w-full min-w-0 max-w-6xl space-y-6 sm:space-y-8">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0 space-y-1">
        <p class="text-xs font-semibold uppercase tracking-wider text-primary-600">Content</p>
        <h1 class="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl lg:text-3xl">
          Marketing Flyers
        </h1>
        <p class="max-w-2xl text-sm text-zinc-500 sm:text-[15px]">
          Upload flyers and group them with your existing Template categories.
        </p>
      </div>
      <div v-if="canReadFlyers" class="flex flex-wrap items-center gap-2">
        <NuxtLink
          :to="categoriesManagePath"
          class="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
        >
          Manage categories
        </NuxtLink>
        <button
          v-if="canAddFlyers"
          type="button"
          class="inline-flex items-center justify-center rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="uploadPending"
          @click="openAddModal"
        >
          Add flyer
        </button>
        <TenantRefreshIconButton
          label="Refresh flyers"
          :pending="pending"
          @click="() => loadAll({ force: true })"
        />
      </div>
    </header>

    <div
      v-if="!canReadFlyers"
      class="rounded-xl border border-zinc-200 bg-white px-5 py-10 text-center shadow-sm"
    >
      <p class="text-sm font-medium text-zinc-900">You do not have access to Custom Flyers.</p>
      <p class="mt-1 text-sm text-zinc-500">
        Ask a superadmin to grant
        <code class="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">marketing:flyers:read</code>
        on your CRM role.
      </p>
    </div>

    <template v-else>
      <div
        v-if="loadError"
        class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        role="alert"
      >
        {{ loadError }}
      </div>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex min-w-0 items-center gap-2 text-sm text-zinc-700">
          <span class="shrink-0 font-medium">Filter</span>
          <TenantFilterSelect
            id="flyers-category-filter"
            :model-value="categoryFilter"
            label="Filter by category"
            variant="field"
            :options="categoryFilterOptions"
            class="w-full min-w-0 max-w-xs sm:w-56"
            @update:model-value="setCategoryFilter"
          />
        </div>
        <p class="shrink-0 text-sm text-zinc-500">
          {{ filteredFlyers.length }} flyer{{ filteredFlyers.length === 1 ? '' : 's' }}
        </p>
      </div>

      <div v-if="pending" class="space-y-4">
        <div v-for="n in 3" :key="n" class="h-40 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
      </div>

      <TenantFlyerEmptyState
        v-else-if="!filteredFlyers.length"
        :has-flyers-outside-filter="flyers.length > 0"
        :can-add-flyers="canAddFlyers"
        :categories-manage-path="categoriesManagePath"
      />

      <div v-else class="space-y-8">
        <section v-for="group in categoryGroups" :key="group.key" class="space-y-3">
          <div class="flex items-baseline justify-between gap-3">
            <h2 class="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              {{ group.label }}
            </h2>
            <span class="text-xs text-zinc-400">{{ group.items.length }}</span>
          </div>
          <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <li v-for="flyer in group.items" :key="flyer.id">
              <TenantFlyerCard
                :flyer="flyer"
                :can-delete="canDeleteFlyers"
                @print="printFlyer(flyer)"
                @view="openFlyerPreview(flyer)"
                @delete="requestDeleteFlyer(flyer)"
                @filter-category="setCategoryFilter"
              />
            </li>
          </ul>
        </section>
      </div>
    </template>

    <TenantAddFlyerModal
      :open="addModalOpen"
      :flyer-name="flyerName"
      :selected-category-id="selectedCategoryId"
      :category-assign-options="categoryAssignOptions"
      :categories-manage-path="categoriesManagePath"
      :has-categories="categories.length > 0"
      :pending-file-name="pendingFlyerFileName"
      :pending-file-size-label="pendingFlyerSizeLabel"
      :pending-content-type="pendingFlyerContentType"
      :pending-preview-url="pendingFlyerPreviewUrl"
      :can-submit="canSubmitFlyer"
      @close="closeAddModal"
      @update:flyer-name="flyerName = $event"
      @update:selected-category-id="selectedCategoryId = $event"
      @file-change="onFlyerFileChange"
      @clear-file="clearPendingFlyerFile"
      @submit="submitFlyerUpload"
    />

    <TenantFlyerUploadLoader
      :open="uploadPending"
      :flyer-name="uploadingFlyerName"
    />

    <TenantFlyerPreviewModal
      :open="previewOpen"
      :flyer="previewFlyer"
      @close="closeFlyerPreview"
      @print="previewFlyer && printFlyer(previewFlyer)"
    />

    <ClientConfirmationModal
      :open="!!flyerToDelete"
      :title="flyerDeleteConfirmTitle"
      :message="deleteModalMessage"
      :confirm-text="flyerDeleteConfirmText"
      variant="danger"
      :confirm-loading="deleteConfirmLoading"
      @confirm="confirmDeleteFlyer"
      @cancel="cancelDeleteFlyer"
    />
  </div>
</template>
