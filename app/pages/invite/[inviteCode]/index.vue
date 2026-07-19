<script setup lang="ts">
import { Loader2 } from "@lucide/vue";
import BackgroundPattern from "~/components/svgs/background-pattern.vue";
import Zadaci from "~/components/svgs/zadaci.vue";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { toast } from "~/lib/toast";

const { params, query } = useRoute();

definePageMeta({
  layout: "auth",
});

const {
  data: workspace,
  error,
  status,
} = await useAsyncData("workspace_invite", () =>
  useRequestFetch()(`/api/workspace/invite/${params.inviteCode}/details?email=${query.email}`),
);
useSeoMeta({
  title: () =>
    workspace.value?.name ? `Join ${workspace.value.name} on Zadaci` : "Workspace Invite",
  description: () =>
    workspace.value?.owner?.username
      ? `You've been invited by ${workspace.value.owner.username} to join ${workspace.value.name} on Zadaci.`
      : "You have been invited to join a workspace on Zadaci.",
  ogTitle: () =>
    workspace.value?.name ? `Join ${workspace.value.name} on Zadaci` : "Workspace Invite",
  ogDescription: () =>
    workspace.value?.owner?.username
      ? `You've been invited by ${workspace.value.owner.username} to join ${workspace.value.name} on Zadaci.`
      : "You have been invited to join a workspace on Zadaci.",
});

const isDeclineInvite = ref(false);
const isAcceptInvite = ref(false);
const declineMessage = ref("");
const acceptMessage = ref("");

function onAcceptInvite() {
  isAcceptInvite.value = true;
  const promise = $fetch(`/api/workspace/invite/${params.inviteCode}/accept`, {
    method: "POST",
    body: { email: query.email },
  });
  toast.promise(promise, {
    loading: "Accepting invite...",
    success: (res: any) => res.message,
    error: (err: any) =>
      err?.response?._data?.statusMessage ?? err?.message ?? "Failed to accept invite",
    position: "top-center",
  });
  promise
    .then((res: any) => {
      acceptMessage.value = res.message;
    })
    .catch(() => {})
    .finally(() => {
      isAcceptInvite.value = false;
    });
}

function onDeclineInvite() {
  isDeclineInvite.value = true;
  const promise = $fetch(`/api/workspace/invite/${params.inviteCode}/decline`, {
    method: "DELETE",
    body: { email: query.email },
  });
  toast.promise(promise, {
    loading: "Declining invite...",
    success: (res: any) => res.message,
    error: (err: any) =>
      err?.response?._data?.statusMessage ?? err?.message ?? "Failed to decline invite",
    position: "top-center",
  });
  promise
    .then((res: any) => {
      declineMessage.value = res.message;
    })
    .catch(() => {})
    .finally(() => {
      isDeclineInvite.value = false;
    });
}
</script>

<template>
  <div class="relative flex h-screen w-full flex-col overflow-hidden">
    <div class="relative size-full overflow-hidden">
      <div class="h-screen w-full overflow-hidden">
        <div class="relative h-screen w-screen overflow-hidden">
          <div class="absolute inset-0 z-0 dark:hidden">
            <BackgroundPattern class="size-full" />
          </div>
          <div
            class="relative z-10 flex h-screen w-screen flex-col overflow-hidden overflow-y-auto"
          >
            <div
              class="container mx-auto flex h-[100vh-60px] max-w-lg grow flex-col justify-center px-10 transition-all lg:px-5"
            >
              <div
                v-if="status === 'idle' || status === 'pending'"
                class="relative flex flex-col items-center"
              >
                <Loader2 class="size-10 animate-spin" />
                <p class="animate-pulse">Loading...!</p>
              </div>
              <div v-else-if="error" class="relative flex flex-col items-center space-y-4">
                <NuxtLink to="/" class="flex items-center gap-x-2.5">
                  <Zadaci class="h-auto w-12" />
                </NuxtLink>
                <div class="text-center">
                  <h3 class="text-3xl font-bold">Whoops..!</h3>
                  <p class="max-w-lg text-balance">
                    {{ error.statusMessage }}
                  </p>
                </div>
                <NuxtLink to="/">
                  <Button
                    class="hover:bg-primary-secondary group inline-flex h-max w-full cursor-pointer items-center justify-center rounded-lg border border-transparent bg-brand px-4 py-2 text-sm font-medium text-white shadow-[0rem_-0.0625rem_0rem_0.0625rem_rgba(249,129,99,1)_inset,_0rem_0rem_0rem_0.0625rem_#F97452_inset,_0rem_0.03125rem_0rem_0.09375rem_#F97452_inset] transition-colors duration-300 ease-in-out hover:translate-y-0.5 hover:shadow-[0rem_-0.0625rem_0rem_0.0625rem_rgba(252,199,185,0.8)_inset,_0rem_0rem_0rem_0.0625rem_#F97452_inset,_0rem_0.03125rem_0rem_0.09375rem_hsla(0,_0%,_100%,_0.25)_inset] focus:ring-4 focus:outline-none disabled:cursor-not-allowed disabled:shadow-xs disabled:hover:shadow-xs"
                  >
                    Continue to Zadaci
                    <Icon
                      name="lucide:arrow-right"
                      class="-rotate-45 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      size="15"
                    />
                  </Button>
                </NuxtLink>
              </div>
              <div v-else-if="acceptMessage" class="relative flex flex-col items-center space-y-4">
                <NuxtLink to="/" class="flex items-center gap-x-2.5">
                  <SvgsZadaci class="h-auto w-12" />
                </NuxtLink>
                <div class="text-center">
                  <p class="max-w-lg text-balance">
                    {{ acceptMessage }}
                  </p>
                </div>
                <NuxtLink to="/auth/signin">
                  <Button
                    class="hover:bg-primary-secondary group inline-flex h-max w-full cursor-pointer items-center justify-center rounded-lg border border-transparent bg-brand px-4 py-2 text-sm font-medium text-white shadow-[0rem_-0.0625rem_0rem_0.0625rem_rgba(249,129,99,1)_inset,_0rem_0rem_0rem_0.0625rem_#F97452_inset,_0rem_0.03125rem_0rem_0.09375rem_#F97452_inset] transition-colors duration-300 ease-in-out hover:translate-y-0.5 hover:shadow-[0rem_-0.0625rem_0rem_0.0625rem_rgba(252,199,185,0.8)_inset,_0rem_0rem_0rem_0.0625rem_#F97452_inset,_0rem_0.03125rem_0rem_0.09375rem_hsla(0,_0%,_100%,_0.25)_inset] focus:ring-4 focus:outline-none disabled:cursor-not-allowed disabled:shadow-xs disabled:hover:shadow-xs"
                  >
                    Signin to Zadaci
                    <Icon
                      name="lucide:arrow-right"
                      class="-rotate-45 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      size="15"
                    />
                  </Button>
                </NuxtLink>
              </div>
              <div v-else-if="declineMessage" class="relative flex flex-col items-center space-y-4">
                <NuxtLink to="/" class="flex items-center gap-x-2.5">
                  <Zadaci class="h-auto w-12" />
                </NuxtLink>
                <div class="text-center">
                  <p class="max-w-lg text-balance">
                    {{ declineMessage }}
                  </p>
                </div>
                <NuxtLink to="/">
                  <Button
                    class="hover:bg-primary-secondary group inline-flex h-max w-full cursor-pointer items-center justify-center rounded-lg border border-transparent bg-brand px-4 py-2 text-sm font-medium text-white shadow-[0rem_-0.0625rem_0rem_0.0625rem_rgba(249,129,99,1)_inset,_0rem_0rem_0rem_0.0625rem_#F97452_inset,_0rem_0.03125rem_0rem_0.09375rem_#F97452_inset] transition-colors duration-300 ease-in-out hover:translate-y-0.5 hover:shadow-[0rem_-0.0625rem_0rem_0.0625rem_rgba(252,199,185,0.8)_inset,_0rem_0rem_0rem_0.0625rem_#F97452_inset,_0rem_0.03125rem_0rem_0.09375rem_hsla(0,_0%,_100%,_0.25)_inset] focus:ring-4 focus:outline-none disabled:cursor-not-allowed disabled:shadow-xs disabled:hover:shadow-xs"
                  >
                    Continue to Zadaci
                    <Icon
                      name="lucide:arrow-right"
                      class="-rotate-45 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      size="15"
                    />
                  </Button>
                </NuxtLink>
              </div>
              <div
                v-else-if="workspace && status === 'success'"
                class="relative flex flex-col space-y-6"
              >
                <div class="space-y-4 text-center">
                  <Avatar class="mx-auto size-12 rounded-md">
                    <AvatarImage :src="workspace.image_url" :alt="workspace.name" />
                    <AvatarFallback class="rounded-md"> CN </AvatarFallback>
                  </Avatar>
                  <h3 class="text-3xl font-bold text-brand dark:text-primary">
                    You've been invited to join the <br />
                    {{ workspace.name }} Workspace in
                    <NuxtLink to="/" target="_blank" class="hover:underline">Zadaci</NuxtLink>.
                  </h3>
                  <div class="space-y-0.5 rounded-xl border py-3">
                    <h4>Managed by:</h4>
                    <div class="flex items-center justify-center gap-x-2">
                      <Avatar>
                        <AvatarImage
                          :src="workspace.owner?.profile_picture_url ?? ''"
                          :alt="workspace.owner?.username ?? ''"
                        />
                        <AvatarFallback>CN</AvatarFallback>
                      </Avatar>
                      <div class="text-start">
                        <h5 class="text-sm">
                          {{ workspace.owner?.username }}
                        </h5>
                        <p class="text-xs text-muted-foreground">
                          {{ workspace.owner?.email }}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div class="grid gap-2">
                    <Button
                      :disabled="isDeclineInvite || isAcceptInvite"
                      class="w-full gap-2 bg-brand hover:bg-brand-secondary dark:text-primary"
                      @click="onAcceptInvite"
                    >
                      <Loader2 v-if="isAcceptInvite" class="size-4 animate-spin" />
                      Join Workspace
                    </Button>
                    <Button
                      variant="ghost"
                      class="w-full gap-2"
                      :disabled="isDeclineInvite || isAcceptInvite"
                      @click="onDeclineInvite"
                    >
                      <Loader2 v-if="isDeclineInvite" class="size-4 animate-spin" />
                      No thanks
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
