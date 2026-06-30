<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import MyTasksWrapper from '~/components/workspace/my-tasks/tabs/MyTasksWrapper.vue'

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
    ? `${currentActiveWorkspace.value?.name} - My Tasks`
    : 'My Tasks',
})

defineOgImage('Zadaci', {
  title: currentActiveWorkspace.value ? `${currentActiveWorkspace.value?.name} - My Tasks` : 'My Tasks',
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
          name: 'My Tasks',
          path: `/workspace/${workspaceId.value}/my-tasks`,
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
      v-if="status ==='idle' || status === 'pending'"
      class="min-h-[70vh] grid place-content-center"
    >
      <div class="flex items-center gap-x-2 text-muted-foreground text-sm">
        <Loader2 class="animate-spin size-5" />
        <p>Loading...</p>
      </div>
    </div>
    <div
      v-else-if="status === 'success' && workspace"
      class="space-y-4"
    >
      <div class="flex items-center gap-x-3">
        <Avatar class="w-12 h-12 sm:w-14 sm:h-14 rounded-md flex-shrink-0">
          <AvatarImage
            :src="currentActiveWorkspace?.imageUrl!"
            :alt="currentActiveWorkspace?.name!"
          />
          <AvatarFallback class="rounded-md">
            CN
          </AvatarFallback>
        </Avatar>
        <div class="min-w-0 flex-1">
          <h1 class="text-lg sm:text-xl font-semibold truncate">
            My Tasks
          </h1>
          <p class="text-xs sm:text-sm text-muted-foreground truncate">
            Overview of all your tasks in <span class="capitalize">{{ currentActiveWorkspace?.name }}</span> Workspace.
          </p>
        </div>
      </div>
      <MyTasksWrapper :workspace-id="workspaceId" />
    </div>
    <div v-else>
      <p class="text-muted-foreground">
        Unable to load data.
      </p>
    </div>
  </section>
</template>
