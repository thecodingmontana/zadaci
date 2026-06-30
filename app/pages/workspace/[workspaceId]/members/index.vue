<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import AccessDenied from '~/components/workspace/global/AccessDenied.vue'
import MembersTabs from '~/components/workspace/members/MembersTabs.vue'

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
    ? `${currentActiveWorkspace.value?.name} - Members`
    : 'Members',
})

defineOgImage('Zadaci', {
  title: currentActiveWorkspace.value ? `${currentActiveWorkspace.value?.name} - Members` : 'Members',
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
          name: 'Members',
          path: `/workspace/${workspaceId.value}/members`,
          children: null,
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
      v-if="currentActiveWorkspace?.userRole ==='OWNER'"
      class="grid gap-4"
    >
      <div>
        <h1 class="text-xl font-medium">
          Members Management
        </h1>
        <p class="max-w-2xl text-muted-foreground">
          Manage your team members and their account permissions access in the workspace.
        </p>
      </div>
      <div
        v-if="status ==='idle' || status ==='pending'"
        class="grid min-h-[50vh] place-content-center"
      >
        <div
          class="flex flex-col items-center gap-1"
        >
          <Loader2 class="size-8 animate-spin" />
          <p class="animate-pulse">
            Loading...
          </p>
        </div>
      </div>
      <MembersTabs v-else-if="status === 'success' && workspace" />
      <div v-else>
        <p class="text-muted-foreground">
          Unable to load data.
        </p>
      </div>
    </div>
    <AccessDenied v-else />
  </section>
</template>
