<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import DeleteAccount from '~/components/workspace/settings/profile/DeleteAccount.vue'
import UserProfile from '~/components/workspace/settings/profile/UserProfile.vue'

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
    ? `${currentActiveWorkspace.value?.name} - Settings Profile`
    : 'Settings Profile',
})

defineOgImage('Zadaci', {
  title: currentActiveWorkspace.value ? `${currentActiveWorkspace.value?.name} - Settings Profile` : 'Settings Profile',
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
              name: 'Profile',
              path: `/workspace/${workspaceId.value}/settings/profile`,
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
  <section class="space-y-4">
    <div>
      <h1 class="text-xl font-medium">
        Profile Settings
      </h1>
      <p class="max-w-2xl text-muted-foreground">
        Manage your details and preferences in your profile settings.
      </p>
    </div>
    <div
      v-if="status ==='idle' || status === 'pending'"
      class="min-h-[70vh] grid place-content-center"
    >
      <div class="flex items-center gap-x-2 text-muted-foreground text-sm">
        <Loader2 class="animate-spin size-5" />
      </div>
    </div>

    <div
      v-else-if="status === 'success' && workspace"
      class="space-y-3"
    >
      <UserProfile />
      <DeleteAccount />
    </div>
    <div v-else>
      <p class="text-muted-foreground">
        Unable to load data.
      </p>
    </div>
  </section>
</template>
