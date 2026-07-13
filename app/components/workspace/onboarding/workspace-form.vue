<script setup lang="ts">
import { ArrowRight, Loader2 } from "@lucide/vue";
import { useForm } from "vee-validate";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { useInvalidateOnboardingDetails } from "~/composables/use-onboarding-details";
import { toast } from "~/lib/toast";
import { useWorkspaceStore } from "~/stores/use-workspace-store";
import { onboardingWorkspaceSchema } from "~/types";
import WorkspaceAvatar from "./workspace-avatar.vue";

const props = defineProps<{
  onSetCurrentStep: (step: number) => void;
}>();

const DEFAULT_WORKSPACE_IMAGE =
  "https://res.cloudinary.com/dfa1yoc1v/image/upload/v1743189693/avatars/thumbs-1743189589089_sfuswl.svg";

const workspaceStore = useWorkspaceStore();
const invalidateOnboardingDetails = useInvalidateOnboardingDetails();

const form = useForm({
  validationSchema: onboardingWorkspaceSchema,
});

const isCreateWorkspace = ref(false);
const isUploadingImage = ref(false);
const selectedWorkspaceAvatar = ref<string | null>(null);
const workspaceImage = ref(DEFAULT_WORKSPACE_IMAGE);

function updateWorkspaceAvatar(avatarStr: string) {
  selectedWorkspaceAvatar.value = avatarStr;
}

async function uploadImageToCloudinary(image: string): Promise<string | undefined> {
  isUploadingImage.value = true;
  try {
    const res = await $fetch("/api/workspace/upload", {
      method: "POST",
      body: { image },
    });
    return res.url;
  } catch (error: any) {
    const errorMessage = error?.response ? error.response._data?.message : error?.message;
    toast.error(errorMessage ?? "Couldn't upload the image, please try again.", {
      position: "top-center",
    });
    return undefined;
  } finally {
    isUploadingImage.value = false;
  }
}

const onSubmit = form.handleSubmit(async (value) => {
  isCreateWorkspace.value = true;
  try {
    if (selectedWorkspaceAvatar.value) {
      workspaceImage.value =
        (await uploadImageToCloudinary(selectedWorkspaceAvatar.value)) || workspaceImage.value;
    }

    const res = await $fetch("/api/workspace/create", {
      method: "POST",
      body: {
        name: value.name,
        image: workspaceImage.value,
      },
    });

    if (res.workspace) {
      workspaceStore.onSetOnboardingWorkspaceId(res.workspace.id);
      await invalidateOnboardingDetails();
      props.onSetCurrentStep(3);
    }
  } catch (error: any) {
    const errorMessage = error?.response ? error.response._data?.message : error?.message;
    toast.error(errorMessage ?? "Couldn't create your workspace, please try again.", {
      position: "top-center",
    });
  } finally {
    isCreateWorkspace.value = false;
  }
});
</script>

<template>
  <form class="mx-auto mt-2 w-full space-y-4 sm:w-96" @submit="onSubmit">
    <WorkspaceAvatar
      :is-create-workspace="isCreateWorkspace"
      :update-workspace-avatar="updateWorkspaceAvatar"
    />
    <FormField v-slot="{ componentField }" name="name">
      <FormItem>
        <FormLabel class="text-sm font-medium after:ml-0.5 after:text-red-500 after:content-['*']">
          Name your workspace
        </FormLabel>
        <FormControl>
          <Input
            type="text"
            placeholder="Something familiar and recognizable is always best."
            v-bind="componentField"
            :disabled="form.isSubmitting.value || isCreateWorkspace"
            class="placeholder:text-custom-text-400 border-onboarding-border-100 block w-full rounded-md border-[0.5px] bg-transparent px-3 py-2 text-sm focus:outline-none"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>
    <button
      type="submit"
      :disabled="isCreateWorkspace"
      class="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded bg-brand px-5 py-2 text-sm font-medium whitespace-nowrap text-white transition-all hover:bg-brand-secondary focus:bg-brand-secondary"
    >
      <Loader2 v-if="isCreateWorkspace" class="size-5 animate-spin" />
      <ArrowRight v-else class="size-4" />
      Create workspace
    </button>
  </form>
</template>
