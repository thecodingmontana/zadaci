<script setup lang="ts">
import { ArrowRight, Loader2, Plus, RotateCw, X } from "@lucide/vue";
import { AnimatePresence, motion } from "motion-v";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useInvalidateOnboardingDetails } from "~/composables/use-onboarding-details";
import { toast } from "~/lib/toast";
import { cn } from "~/lib/utils";
import { useWorkspaceStore } from "~/stores/use-workspace-store";

const workspaceStore = useWorkspaceStore();
const invalidateOnboardingDetails = useInvalidateOnboardingDetails();

const workspaceId = computed(() => workspaceStore.onboardingWorkspaceId);

const randomEmails = [
  "alex@example.com",
  "sophia@example.com",
  "mike@workmail.com",
  "emma@company.io",
  "john.doe@biz.net",
  "lucas@startup.dev",
  "chris@agency.com",
  "natalie@freelance.me",
];

function getRandomEmail() {
  return randomEmails[Math.floor(Math.random() * randomEmails.length)];
}

function createTeammate() {
  return {
    id: crypto.randomUUID(),
    email: "",
    role: "member" as const,
    placeholder: getRandomEmail(),
  };
}

const teammates = ref([createTeammate()]);
const isSendingInvites = ref(false);

async function addUser() {
  teammates.value.push(createTeammate());
  await nextTick();
}

function removeUser(id: string) {
  teammates.value = teammates.value.filter((teammate) => teammate.id !== id);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(email);
}

const isUserSelected = computed(
  () =>
    teammates.value.length > 0 && teammates.value.every((teammate) => isValidEmail(teammate.email)),
);

async function onSendInvites() {
  isSendingInvites.value = true;
  try {
    const res = await $fetch(`/api/workspace/${workspaceId.value}/teammates/team-invite/send`, {
      method: "POST",
      body: { teammates: teammates.value },
    });

    toast.success(res.message ?? "Invites sent successfully", {
      desc: "Redirecting you to your workspace",
      position: "top-center",
      action: {
        label: "Continue",
        icon: ArrowRight,
      },
    });

    return navigateTo(`/workspace/${workspaceId.value}/dashboard`);
  } catch (error: any) {
    const errorMessage = error?.response ? error.response._data?.message : error?.message;

    toast.error(errorMessage ?? "Couldn't send invites, please try again.", {
      desc: "Check the emails and try again",
      position: "top-center",
      action: {
        label: "Retry",
        icon: RotateCw,
        onClick: onSendInvites,
      },
    });
  } finally {
    isSendingInvites.value = false;
  }
}

async function onDoItLater() {
  await invalidateOnboardingDetails();
  return navigateTo(`/workspace/${workspaceId.value}/dashboard`);
}
</script>

<template>
  <div class="grid w-full max-w-xl gap-3">
    <div class="grid grid-cols-2 gap-3">
      <Label>Email</Label>
      <Label>Role</Label>
    </div>

    <div class="grid gap-1">
      <AnimatePresence>
        <template v-for="teammate in teammates" :key="teammate.id">
          <motion.div
            :initial="{ opacity: 0, x: 30 }"
            :animate="{ opacity: 1, x: 0 }"
            :exit="{ opacity: 0, x: -30 }"
            :transition="{ duration: 0.4 }"
            class="group grid grid-cols-2 items-center gap-3"
          >
            <Input
              v-model="teammate.email"
              type="text"
              :placeholder="teammate.placeholder"
              :disabled="isSendingInvites"
              class="placeholder:text-custom-text-400 border-onboarding-border-100 block w-full rounded-md border-[0.5px] bg-transparent px-3 py-2 text-sm focus:outline-none"
            />
            <div class="relative flex items-center">
              <Select v-model="teammate.role" :disabled="isSendingInvites">
                <SelectTrigger
                  :id="`select-role-${teammate.id}`"
                  class="w-full outline-none focus:ring-0 focus:ring-offset-0 focus:outline-none"
                >
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>

              <Button
                v-if="teammates.length > 1"
                variant="ghost"
                size="icon"
                class="absolute -right-12 size-8 rounded-full border text-destructive hover:text-rose-400"
                @click="removeUser(teammate.id)"
              >
                <X class="size-4" />
              </Button>
            </div>
          </motion.div>
        </template>
      </AnimatePresence>
    </div>

    <Button
      variant="ghost"
      class="w-fit cursor-pointer text-brand hover:text-brand-secondary"
      @click="addUser"
    >
      <Plus />
      Add another
    </Button>

    <div class="text-center text-sm text-muted-foreground">
      <p>
        <span class="font-semibold">Owner</span> – Full control over workspace settings, members,
        and deletion.
      </p>
      <p>
        <span class="font-semibold">Moderator</span> – Can manage projects, tasks, teams, channels,
        and members.
      </p>
      <p>
        <span class="font-semibold">Member</span> – Can create and manage projects and tasks they
        are assigned to.
      </p>
    </div>

    <div class="flex flex-col items-center gap-1">
      <Button
        :disabled="!isUserSelected || isSendingInvites"
        :class="
          cn(
            'flex w-full max-w-sm items-center justify-center gap-1.5 rounded px-5 py-2 text-sm font-medium whitespace-nowrap text-white transition-all',
            !isUserSelected || isSendingInvites
              ? 'cursor-not-allowed bg-brand-secondary'
              : 'cursor-pointer bg-brand hover:bg-brand-secondary focus:bg-brand-secondary',
          )
        "
        @click="onSendInvites"
      >
        <Loader2 v-if="isSendingInvites" class="size-5 animate-spin" />
        <ArrowRight v-else class="size-4" />
        Send invites
      </Button>

      <Button
        :disabled="isSendingInvites"
        variant="link"
        class="w-full max-w-sm cursor-pointer"
        @click="onDoItLater"
      >
        I'll do it later
      </Button>
    </div>
  </div>
</template>
