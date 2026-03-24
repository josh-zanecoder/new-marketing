<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const slug = Array.isArray(route.params.slug) ? route.params.slug : []
const target = slug.length ? `/tenant/${slug.join('/')}` : '/tenant/dashboard'
await navigateTo(target, { redirectCode: 301 })
</script>
