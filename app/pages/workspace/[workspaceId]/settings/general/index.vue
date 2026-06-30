<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import AccessDenied from '~/components/workspace/global/AccessDenied.vue'
import DeleteWorkspace from '~/components/workspace/settings/general/DeleteWorkspace.vue'
import WorkspaceInfo from '~/components/workspace/settings/general/WorkspaceInfo.vue'

definePageMeta({
  middleware: ['authenticated'],
  layout: 'workspace',
})

const workspaceStore = useWorkspaceStore()
const route = useRoute()
const workspaceId = computed(() => {
  const paramId = route.params.workspaceId as string
  return (paramId && paramId !== 'undefined') ? paramId : workspaceStore.activeWorkspace?.id
})

const currentActiveWorkspace = computed(() => {
  return workspaceStore.activeWorkspace
})

useHead({
  title: currentActiveWorkspace.value
    ? `${currentActiveWorkspace.value?.name} - Settings General`
    : 'Settings General',
})

defineOgImage('Zadaci', {
  title: currentActiveWorkspace.value ? `${currentActiveWorkspace.value?.name} - Settings General` : 'Settings General',
  description:
    'Zadaci is an all-in-one project management platform built to help you and your team get things done faster.',
})

const { data: workspace, status } = await useAsyncData(() => useRequestFetch()(`/api/workspace/${workspaceId.value}/details/user-exists`), { watch: [workspaceId] })

onBeforeMount(() => {
  if (!workspace.value) {
    navigateTo('/workspace/onboarding')
  }
})

onMounted(() => {
  if (!workspace.value) {
    workspaceStore?.onSetActiveWorkspace(null)
    navigateTo('/workspace/onboarding')
  }
  else {
    workspaceStore?.onSetWorkspaceBreadcrumb({
      name: `${currentActiveWorkspace.value?.name}`,
      path: `/workspace/${workspaceId.value}/dashboard`,
      children: [
        {
          name: 'Settings',
          path: `/workspace/${workspaceId.value}/settings/general`,
          children: [
            {
              name: 'General',
              path: `/workspace/${workspaceId.value}/settings/general`,
              children: null,
            },
          ],
        },
      ],
    })
    if (workspace.value && !workspaceStore.activeWorkspace) {
      workspaceStore.onSetActiveWorkspace(workspace.value)
    }
  }
})
</script>

<template>
  <section>
    <div
      v-if="status ==='idle' || status === 'pending'"
      class="min-h-[70vh] grid place-content-center"
    >
      <div class="flex items-center gap-x-2 text-muted-foreground text-sm">
        <Loader2 class="animate-spin size-5" />
      </div>
    </div>

    <div v-else-if="status === 'success' && workspace">
      <div
        v-if="currentActiveWorkspace?.userRole ==='OWNER'"
        class="grid gap-y-3"
      >
        <div>
          <h1 class="text-xl font-medium">
            General Settings
          </h1>
          <p class="max-w-xl text-balance text-muted-foreground">
            Manage your workspace settings and preferences.
          </p>
        </div>
        <div class="grid gap-y-3">
          <WorkspaceInfo />
          <DeleteWorkspace />
        </div>
      </div>
      <AccessDenied v-else />
    </div>
    <div v-else>
      <p class="text-muted-foreground">
        Unable to load data.
      </p>
    </div>
  </section>
</template>
