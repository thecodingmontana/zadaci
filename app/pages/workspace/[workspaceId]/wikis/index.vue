<script setup lang="ts">
import Editor from '~/components/workspace/wikis/editor/EditorContainer.vue'

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
// const modalStore = useModalStore()

const currentActiveWorkspace = computed(() => {
  return workspaceStore.activeWorkspace
})

useHead({
  title: currentActiveWorkspace.value
    ? `${currentActiveWorkspace.value?.name} - Wikis`
    : 'Wikis',
})

defineOgImage('UseOdama', {
  title: currentActiveWorkspace.value ? `${currentActiveWorkspace.value?.name} - Wikis` : 'Wikis',
  description:
    'Zadaci is an all-in-one project management platform built to help you and your team get things done faster.',
})

const { data: workspace } = await useAsyncData(() => useRequestFetch()(`/api/workspace/${workspaceId.value}/details/user-exists`), { watch: [workspaceId] })

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
      name: 'Wikis',
      path: `/workspace/${workspaceId.value}/dashboard`,
      children: null,
    })
    if (workspace.value && !workspaceStore.activeWorkspace) {
      workspaceStore.onSetActiveWorkspace(workspace.value)
    }
  }
})
</script>

<template>
  <div class="h-full bg-[#fafafa] dark:bg-[#1d1d1d]">
    <main class="h-screen relative">
      <Editor />
    </main>
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.25s ease-out;
}
.slide-up-enter-from {
  opacity: 0;
  transform: translateY(30px);
}
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-30px);
}
</style>
