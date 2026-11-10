<script setup lang="ts">
import { fetchErrorMessage } from '~/utils/fetchErrorMessage'
import {
  TENANT_FEATURE_PERMISSIONS,
  groupTenantFeaturePermissions,
  tenantFeaturePermissionStateFrom,
  type TenantFeaturePermission,
  type TenantFeaturePermissionKey,
  type TenantFeaturePermissionState
} from '~~/shared/tenantFeaturePermissions'

const props = defineProps<{
  dbName: string
  value: Partial<TenantFeaturePermissionState> | null | undefined
}>()

const emit = defineEmits<{
  saved: [value: TenantFeaturePermissionState]
}>()

const groups = groupTenantFeaturePermissions()
const search = ref('')
const expanded = reactive<Record<string, boolean>>(
  Object.fromEntries(groups.map((group) => [group.key, true]))
)
const draft = ref<TenantFeaturePermissionState>(tenantFeaturePermissionStateFrom(props.value))
const saving = ref(false)
const error = ref('')
const savedMessage = ref('')

watch(
  () => props.value,
  (value) => {
    if (saving.value) return
    draft.value = tenantFeaturePermissionStateFrom(value)
  },
  { deep: true }
)

const saved = computed(() => tenantFeaturePermissionStateFrom(props.value))
const selectedCount = computed(
  () => TENANT_FEATURE_PERMISSIONS.filter((permission) => draft.value[permission.key]).length
)
const isDirty = computed(() =>
  TENANT_FEATURE_PERMISSIONS.some((permission) => draft.value[permission.key] !== saved.value[permission.key])
)

const filteredGroups = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return groups
  return groups
    .map((group) => ({
      ...group,
      permissions: group.permissions.filter((permission) => {
        const haystack = `${permission.code} ${permission.label} ${permission.description}`.toLowerCase()
        return haystack.includes(q) || group.label.toLowerCase().includes(q)
      })
    }))
    .filter((group) => group.permissions.length > 0)
})

function isSelected(key: TenantFeaturePermissionKey) {
  return draft.value[key]
}

function toggle(key: TenantFeaturePermissionKey) {
  if (saving.value) return
  savedMessage.value = ''
  draft.value = { ...draft.value, [key]: !draft.value[key] }
}

function setGroup(permissions: TenantFeaturePermission[], selected: boolean) {
  if (saving.value) return
  savedMessage.value = ''
  const next = { ...draft.value }
  for (const permission of permissions) next[permission.key] = selected
  draft.value = next
}

function groupChecked(permissions: TenantFeaturePermission[]) {
  return permissions.length > 0 && permissions.every((permission) => draft.value[permission.key])
}

async function save() {
  if (!isDirty.value || saving.value) return
  saving.value = true
  error.value = ''
  savedMessage.value = ''
  try {
    for (const permission of TENANT_FEATURE_PERMISSIONS) {
      if (draft.value[permission.key] === saved.value[permission.key]) continue
      await $fetch(
        `/api/v1/admin/tenants/db/${encodeURIComponent(props.dbName)}/${permission.patchPath}`,
        {
          method: 'PATCH',
          body: { [permission.key]: draft.value[permission.key] }
        }
      )
    }
    emit('saved', { ...draft.value })
    savedMessage.value = 'Permissions saved'
  } catch (e) {
    error.value = fetchErrorMessage(e, 'Could not save permissions')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="tenant-permissions-heading">
    <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-4 sm:px-5">
      <div class="min-w-0">
        <h2 id="tenant-permissions-heading" class="text-sm font-medium text-slate-900">
          Permissions
        </h2>
        <p class="mt-0.5 text-xs text-slate-500">
          These apply to the whole tenant. They are not split by role.
        </p>
      </div>
      <p class="text-2xl font-semibold tabular-nums text-slate-900">
        {{ selectedCount }}
        <span class="text-sm font-normal text-slate-400">/ {{ TENANT_FEATURE_PERMISSIONS.length }}</span>
      </p>
    </div>

    <div class="border-b border-slate-100 px-4 py-3 sm:px-5">
      <label class="sr-only" for="tenant-permissions-search">Search permissions</label>
      <input
        id="tenant-permissions-search"
        v-model="search"
        type="search"
        placeholder="Search permissions"
        class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary-300 focus:outline-none focus:ring-[3px] focus:ring-primary-500/20"
      >
    </div>

    <p v-if="error" class="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800 sm:px-5" role="alert">
      {{ error }}
    </p>
    <p v-else-if="savedMessage" class="border-b border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 sm:px-5" role="status">
      {{ savedMessage }}
    </p>

    <div class="space-y-2 p-3 sm:p-4">
      <p
        v-if="filteredGroups.length === 0"
        class="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500"
      >
        No permissions match this search.
      </p>
      <section
        v-for="group in filteredGroups"
        :key="group.key"
        class="overflow-hidden rounded-xl border border-slate-200"
      >
        <div class="flex items-center gap-3 border-b border-slate-100 bg-slate-50/80 px-3 py-3">
          <input
            type="checkbox"
            class="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500/30"
            :checked="groupChecked(group.permissions)"
            :disabled="saving"
            :aria-label="`Select all ${group.label} permissions`"
            @change="setGroup(group.permissions, ($event.target as HTMLInputElement).checked)"
          >
          <button
            type="button"
            class="min-w-0 flex-1 text-left text-sm font-semibold text-slate-900"
            @click="expanded[group.key] = !expanded[group.key]"
          >
            {{ group.label }}
            <span class="ml-2 text-xs font-normal text-slate-500">
              {{ group.permissions.filter((permission) => isSelected(permission.key)).length }} / {{ group.permissions.length }}
            </span>
          </button>
        </div>
        <ul v-show="expanded[group.key]" class="divide-y divide-slate-100">
          <li v-for="permission in group.permissions" :key="permission.key">
            <label class="flex cursor-pointer items-start gap-3 px-3 py-3 hover:bg-slate-50/80">
              <input
                type="checkbox"
                class="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500/30"
                :checked="isSelected(permission.key)"
                :disabled="saving"
                @change="toggle(permission.key)"
              >
              <span class="min-w-0">
                <span class="block text-sm font-medium text-slate-900">{{ permission.label }}</span>
                <span class="mt-0.5 block font-mono text-[11px] text-slate-400">{{ permission.code }}</span>
                <span class="mt-1 block text-xs leading-relaxed text-slate-500">{{ permission.description }}</span>
              </span>
            </label>
          </li>
        </ul>
      </section>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-5">
      <p class="text-sm text-slate-500">
        <span v-if="isDirty">Unsaved changes</span>
        <span v-else>Saved</span>
      </p>
      <button
        type="button"
        class="inline-flex items-center justify-center rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!isDirty || saving"
        @click="save"
      >
        {{ saving ? 'Saving…' : 'Save permissions' }}
      </button>
    </div>
  </section>
</template>
