<script setup lang="ts">
definePageMeta({ layout: 'default' })

const {
  pending,
  saving,
  loadError,
  formError,
  searchQuery,
  name,
  description,
  isEditing,
  filteredCategories,
  resetForm,
  startEdit,
  loadCategories,
  saveCategory,
  removeCategory,
  formatUpdated,
  viewTemplatesHref
} = useEmailTemplateCategoriesPage()

onMounted(() => {
  void loadCategories()
})
</script>

<template>
  <div class="mx-auto w-full min-w-0 max-w-6xl space-y-6 overflow-x-hidden antialiased sm:space-y-8">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wider text-primary-600">Content</p>
        <h1 class="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">
          Template categories
        </h1>
        <p class="mt-1.5 max-w-2xl text-sm text-slate-500 sm:text-[0.9375rem] sm:leading-relaxed">
          Create categories to organize email templates. Click a category name to open the library filtered to that category, then assign categories when saving templates.
        </p>
      </div>
      <div class="flex items-center gap-2 sm:shrink-0">
        <NuxtLink
          to="/tenant/email-templates"
          class="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Back to templates
        </NuxtLink>
        <TenantRefreshIconButton
          label="Refresh categories"
          :pending="pending"
          @click="() => loadCategories({ force: true })"
        />
      </div>
    </header>

    <div
      v-if="loadError"
      class="flex gap-3.5 rounded-2xl border border-red-200/90 bg-red-50 px-5 py-4 text-sm leading-snug text-red-900 shadow-sm"
      role="alert"
    >
      {{ loadError }}
    </div>

    <form
      class="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"
      @submit.prevent="saveCategory"
    >
      <div class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="text-base font-semibold text-slate-900">
            {{ isEditing ? 'Edit category' : 'Create category' }}
          </h2>
          <p class="mt-1 text-sm text-slate-500">
            Names must be unique. Deleting a category leaves its templates uncategorized.
          </p>
        </div>
        <button
          v-if="isEditing"
          type="button"
          class="mt-3 text-sm font-semibold text-primary-600 hover:text-primary-700 sm:mt-0"
          @click="resetForm"
        >
          Cancel edit
        </button>
      </div>

      <div class="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label class="block text-sm font-medium text-slate-700" for="category-name">Name</label>
          <input
            id="category-name"
            v-model="name"
            type="text"
            required
            maxlength="80"
            placeholder="e.g. Newsletter"
            class="mt-1.5 w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-primary-300 focus:outline-none focus:ring-[3px] focus:ring-primary-500/20"
          >
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700" for="category-description">Description</label>
          <input
            id="category-description"
            v-model="description"
            type="text"
            maxlength="200"
            placeholder="Optional short description"
            class="mt-1.5 w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-primary-300 focus:outline-none focus:ring-[3px] focus:ring-primary-500/20"
          >
        </div>
      </div>

      <p v-if="formError" class="mt-3 text-sm text-red-600" role="alert">
        {{ formError }}
      </p>

      <div class="mt-5 flex justify-end">
        <button
          type="submit"
          class="inline-flex items-center justify-center rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary-600/20 transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="saving"
        >
          {{ saving ? 'Saving…' : (isEditing ? 'Save changes' : 'Create category') }}
        </button>
      </div>
    </form>

    <div class="relative min-w-0 max-w-lg">
      <label class="sr-only" for="categories-search">Search categories</label>
      <svg class="pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        id="categories-search"
        v-model="searchQuery"
        type="search"
        autocomplete="off"
        placeholder="Search categories…"
        class="w-full rounded-xl border border-slate-200/90 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] placeholder:text-slate-400 transition-colors focus:border-primary-300 focus:outline-none focus:ring-[3px] focus:ring-primary-500/20"
      >
    </div>

    <div v-if="pending" class="space-y-3">
      <div v-for="n in 4" :key="n" class="h-16 animate-pulse rounded-2xl border border-slate-200/80 bg-white" />
    </div>

    <div
      v-else-if="!filteredCategories.length"
      class="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-14 text-center shadow-sm sm:px-6 sm:py-16"
    >
      <h3 class="text-lg font-semibold text-slate-900">
        {{ searchQuery.trim() ? 'No matching categories' : 'No categories yet' }}
      </h3>
      <p class="mt-2 max-w-sm text-sm text-slate-500">
        {{ searchQuery.trim() ? 'Try a different search.' : 'Create your first category above to organize templates.' }}
      </p>
    </div>

    <ul v-else class="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <li
        v-for="row in filteredCategories"
        :key="row.id"
        class="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
      >
        <div class="min-w-0">
          <NuxtLink
            :to="viewTemplatesHref(row.id)"
            class="truncate text-sm font-semibold text-slate-900 hover:text-primary-700 hover:underline"
            :title="`View templates in ${row.name}`"
          >
            {{ row.name }}
          </NuxtLink>
          <p v-if="row.description?.trim()" class="mt-0.5 truncate text-sm text-slate-500">
            {{ row.description }}
          </p>
          <p class="mt-1 text-xs text-slate-400">
            Updated {{ formatUpdated(row.updatedAt) }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <NuxtLink
            :to="viewTemplatesHref(row.id)"
            class="inline-flex items-center justify-center rounded-xl border border-primary-200 bg-primary-50/80 px-3 py-2 text-sm font-semibold text-primary-800 shadow-sm hover:border-primary-300 hover:bg-primary-100/80"
          >
            View templates
          </NuxtLink>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:border-primary-200 hover:bg-primary-50/80 hover:text-primary-800"
            @click="startEdit(row)"
          >
            Edit
          </button>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50"
            @click="removeCategory(row)"
          >
            Delete
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>
