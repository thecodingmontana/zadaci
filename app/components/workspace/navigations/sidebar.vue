<script setup lang="ts">
import type { Workspace, WorkspaceBreadcrumb } from "~/types";
import { motion } from "motion-v";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Skeleton } from "~/components/ui/skeleton";
import { useSidebarProjects } from "~/composables/use-sidebar-projects";
import { useWorkspaces } from "~/composables/use-workspaces";
import { useModalStore } from "~/stores/use-modal-store";
import { useWorkspaceStore } from "~/stores/use-workspace-store";
import ToggleTheme from "./toggle-theme.vue";
import User from "./user.vue";
import WorkspaceSwitcher from "./workspace-switcher.vue";

const workspaceStore = useWorkspaceStore();
const modalStore = useModalStore();
const { params } = useRoute();
const route = useRoute();

const isOpenSidebar = computed(() => workspaceStore?.isOpenSidebar);

function onNavigateToPage(payload: WorkspaceBreadcrumb, pageName: string) {
  workspaceStore?.onSetWorkspaceBreadcrumb(payload);
  navigateTo(pageName);
}

function onAddNewProject() {
  modalStore?.onOpen("addNewProject");
  modalStore?.setIsOpen(true);
}

const { data: workspaces, status: workspacesStatus } = useWorkspaces();
const currentActiveWorkspace = computed(() => workspaceStore.activeWorkspace);

onMounted(() => {
  if (workspaces.value && workspaces.value.length > 0) {
    if (workspaceStore.activeWorkspace) {
      const activeWorkspace = workspaces.value.find(
        (w: Workspace) => w.id === workspaceStore.activeWorkspace?.id,
      );
      const workspaceId = params.workspaceId;

      if (workspaceId !== activeWorkspace?.id && activeWorkspace?.id) {
        workspaceStore?.onSetWorkspaceBreadcrumb({
          name: "Dashboard",
          path: `/workspace/${activeWorkspace.id}/dashboard`,
          children: null,
        });
        return navigateTo(`/workspace/${activeWorkspace.id}/dashboard`);
      }
    } else {
      const firstWorkspace = workspaces.value[0];
      if (firstWorkspace?.id) {
        workspaceStore.onSetActiveWorkspace(firstWorkspace);
        workspaceStore?.onSetWorkspaceBreadcrumb({
          name: "Dashboard",
          path: `/workspace/${firstWorkspace.id}/dashboard`,
          children: null,
        });
        navigateTo(`/workspace/${firstWorkspace.id}/dashboard`);
      }
    }
  }
});

const { data: projects, status: projectsStatus } = useSidebarProjects(
  computed(() => currentActiveWorkspace.value?.id),
);

function isActivePath(path: string) {
  return route.path === path || route.path.startsWith(`${path}/`);
}

const navItemClasses = (path: string) => [
  "flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 text-sm font-medium transition-colors",
  isActivePath(path)
    ? "bg-black text-white dark:bg-white dark:text-black"
    : "hover:bg-[#f1f1f1] dark:hover:bg-[#343434]",
];
</script>

<template>
  <motion.div
    class="fixed top-0 z-20 hidden h-screen shrink-0 overflow-hidden bg-[#fafafa] md:block dark:bg-[#1d1d1d]"
    :animate="{ width: isOpenSidebar ? 288 : 0 }"
    :transition="{ duration: 0.3, ease: 'easeInOut' }"
  >
    <motion.div
      class="relative flex h-full w-72 flex-col p-1"
      :animate="{ opacity: isOpenSidebar ? 1 : 0 }"
      :transition="{ duration: 0.2, delay: isOpenSidebar ? 0.12 : 0 }"
    >
      <WorkspaceSwitcher :status="workspacesStatus" :workspaces="workspaces ?? []" />

      <ScrollArea class="h-full flex-1 space-y-4 py-3">
        <div class="flex flex-col gap-0.5">
          <button
            :class="navItemClasses(`/workspace/${currentActiveWorkspace?.id}/dashboard`)"
            @click="
              onNavigateToPage(
                {
                  name: 'Dashboard',
                  path: `/workspace/${currentActiveWorkspace?.id}/dashboard`,
                  children: null,
                },
                `/workspace/${currentActiveWorkspace?.id}/dashboard`,
              )
            "
          >
            <Icon name="solar:home-angle-2-outline" class="size-4 shrink-0" />
            Dashboard
          </button>
          <button
            v-if="currentActiveWorkspace?.userRole === 'OWNER'"
            :class="navItemClasses(`/workspace/${currentActiveWorkspace?.id}/members`)"
            @click="
              onNavigateToPage(
                {
                  name: `${currentActiveWorkspace?.name}`,
                  path: `/workspace/${currentActiveWorkspace?.id}/dashboard`,
                  children: [
                    {
                      name: 'My Tasks',
                      path: `/workspace/${currentActiveWorkspace?.id}/members`,
                      children: null,
                    },
                  ],
                },
                `/workspace/${currentActiveWorkspace?.id}/members`,
              )
            "
          >
            <Icon name="solar:users-group-two-rounded-outline" class="size-4 shrink-0" />
            Members
          </button>
          <button
            :class="navItemClasses(`/workspace/${currentActiveWorkspace?.id}/my-tasks`)"
            @click="
              onNavigateToPage(
                {
                  name: `${currentActiveWorkspace?.name}`,
                  path: `/workspace/${currentActiveWorkspace?.id}/dashboard`,
                  children: [
                    {
                      name: 'My Tasks',
                      path: `/workspace/${currentActiveWorkspace?.id}/my-tasks`,
                      children: null,
                    },
                  ],
                },
                `/workspace/${currentActiveWorkspace?.id}/my-tasks`,
              )
            "
          >
            <Icon name="hugeicons:task-01" class="size-4 shrink-0" />
            My Tasks
          </button>
        </div>

        <div class="grid gap-0.5">
          <h3 class="p-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Projects
          </h3>
          <div class="flex flex-col gap-0.5">
            <button
              class="flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 text-sm font-medium hover:bg-[#f1f1f1] dark:hover:bg-[#343434]"
              @click="onAddNewProject"
            >
              <Icon name="solar:add-folder-outline" class="size-4 shrink-0" />
              New Project
            </button>
            <button
              :class="navItemClasses(`/workspace/${currentActiveWorkspace?.id}/projects/all`)"
              @click="
                onNavigateToPage(
                  {
                    name: `${currentActiveWorkspace?.name}`,
                    path: `/workspace/${currentActiveWorkspace?.id}/dashboard`,
                    children: [
                      {
                        name: 'Projects',
                        path: `/workspace/${currentActiveWorkspace?.id}/projects/all`,
                        children: [
                          {
                            name: 'All',
                            path: `/workspace/${currentActiveWorkspace?.id}/projects/all`,
                            children: null,
                          },
                        ],
                      },
                    ],
                  },
                  `/workspace/${currentActiveWorkspace?.id}/projects/all`,
                )
              "
            >
              <Icon name="solar:folder-with-files-outline" class="size-4 shrink-0" />
              All Projects
            </button>

            <div v-if="projectsStatus === 'pending'" class="flex flex-col gap-1.5 px-1 py-1">
              <Skeleton v-for="i in 4" :key="i" class="h-8 w-full rounded-lg" />
            </div>
            <template v-else>
              <button
                v-for="project in projects"
                :key="project.id"
                class="truncate capitalize"
                :class="[
                  ...navItemClasses(
                    `/workspace/${currentActiveWorkspace?.id}/projects/${project.id}`,
                  ),
                ]"
                @click="
                  onNavigateToPage(
                    {
                      name: `${currentActiveWorkspace?.name}`,
                      path: `/workspace/${currentActiveWorkspace?.id}/dashboard`,
                      children: [
                        {
                          name: 'Projects',
                          path: `/workspace/${currentActiveWorkspace?.id}/dashboard`,
                          children: [
                            {
                              name: `${project.title}`,
                              path: `/workspace/projects/${project.id}`,
                              children: null,
                            },
                          ],
                        },
                      ],
                    },
                    `/workspace/${currentActiveWorkspace?.id}/projects/${project.id}`,
                  )
                "
              >
                <Icon name="solar:folder-with-files-outline" class="size-4 shrink-0" />
                <span class="w-full truncate text-start">{{ project.title }}</span>
              </button>
            </template>
          </div>
        </div>

        <div class="grid gap-0.5">
          <h3 class="p-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Settings
          </h3>
          <div class="flex flex-col gap-0.5">
            <button
              v-if="currentActiveWorkspace?.userRole === 'OWNER'"
              :class="navItemClasses(`/workspace/${currentActiveWorkspace?.id}/settings/general`)"
              @click="
                onNavigateToPage(
                  {
                    name: `${currentActiveWorkspace?.name}`,
                    path: `/workspace/${currentActiveWorkspace?.id}/dashboard`,
                    children: [
                      {
                        name: 'Settings',
                        path: `/workspace/${currentActiveWorkspace?.id}/settings/general`,
                        children: [
                          {
                            name: 'General',
                            path: `/workspace/${currentActiveWorkspace?.id}/settings/general`,
                            children: null,
                          },
                        ],
                      },
                    ],
                  },
                  `/workspace/${currentActiveWorkspace?.id}/settings/general`,
                )
              "
            >
              <Icon name="solar:settings-outline" class="size-4 shrink-0" />
              General
            </button>
            <button
              :class="navItemClasses(`/workspace/${currentActiveWorkspace?.id}/settings/profile`)"
              @click="
                onNavigateToPage(
                  {
                    name: `${currentActiveWorkspace?.name}`,
                    path: `/workspace/${currentActiveWorkspace?.id}/dashboard`,
                    children: [
                      {
                        name: 'Settings',
                        path: `/workspace/${currentActiveWorkspace?.id}/settings/profile`,
                        children: [
                          {
                            name: 'Profile',
                            path: `/workspace/${currentActiveWorkspace?.id}/settings/profile`,
                            children: null,
                          },
                        ],
                      },
                    ],
                  },
                  `/workspace/${currentActiveWorkspace?.id}/settings/profile`,
                )
              "
            >
              <Icon name="hugeicons:user-settings-01" class="size-4 shrink-0" />
              Profile
            </button>
            <button
              :class="navItemClasses(`/workspace/${currentActiveWorkspace?.id}/settings/security`)"
              @click="
                onNavigateToPage(
                  {
                    name: 'Settings',
                    path: `/workspace/${currentActiveWorkspace?.id}/settings/general`,
                    children: [
                      {
                        name: 'Security',
                        path: `/workspace/${currentActiveWorkspace?.id}/settings/security`,
                        children: null,
                      },
                    ],
                  },
                  `/workspace/${currentActiveWorkspace?.id}/settings/security`,
                )
              "
            >
              <Icon name="solar:lock-password-outline" class="size-4 shrink-0" />
              Security
            </button>
            <ToggleTheme side="bottom" />
          </div>
        </div>
      </ScrollArea>

      <div class="mt-auto w-full space-y-3 bg-transparent dark:bg-[#1d1d1d]">
        <div class="grid gap-0.5">
          <h3 class="p-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">App</h3>
          <button
            :class="navItemClasses(`/workspace/${currentActiveWorkspace?.id}/support`)"
            @click="
              onNavigateToPage(
                {
                  name: `${currentActiveWorkspace?.name}`,
                  path: `/workspace/${currentActiveWorkspace?.id}/dashboard`,
                  children: [
                    {
                      name: 'Support',
                      path: `/workspace/${currentActiveWorkspace?.id}/support`,
                      children: null,
                    },
                  ],
                },
                `/workspace/${currentActiveWorkspace?.id}/support`,
              )
            "
          >
            <Icon name="solar:help-outline" class="size-4 shrink-0" />
            Support
          </button>
        </div>
        <User />
      </div>
    </motion.div>
  </motion.div>
</template>
