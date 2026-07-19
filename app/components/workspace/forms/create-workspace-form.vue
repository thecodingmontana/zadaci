<script setup lang="ts">
import { ArrowRight, Loader } from "@lucide/vue";
import { useQueryClient } from "@tanstack/vue-query";
import { useForm } from "vee-validate";
import { Button } from "~/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { toast } from "~/lib/toast";
import { cn } from "~/lib/utils";
import { useModalStore } from "~/stores/use-modal-store";
import { createWorkspaceSchema } from "~/types/forms/schema";
import FileUpload from "../shared/file-upload.vue";

const modalStore = useModalStore();
const isUploadingImg = ref(false);

const form = useForm({
  validationSchema: createWorkspaceSchema,
  initialValues: {
    name: "",
    image: "",
  },
});

const isCreatingWorkspace = ref(false);
const queryClient = useQueryClient();

const isSubmitting = computed(() => {
  if (!form.controlledValues.value.name || form.errors.value.name || isCreatingWorkspace.value) {
    return true;
  }
  return false;
});

function onClose() {
  modalStore.onClose();
  modalStore.setIsOpen(false);
}

async function uploadImageToCloudinary(image: string): Promise<string | undefined> {
  isUploadingImg.value = true;
  try {
    const res = await $fetch("/api/workspace/upload", {
      method: "POST",
      body: { image },
    });
    return res.url;
  } catch {
    return undefined;
  } finally {
    isUploadingImg.value = false;
  }
}

const onCreateWorkspace = form.handleSubmit(async (values) => {
  isCreatingWorkspace.value = true;

  const defaultImage = `https://avatar.vercel.sh/vercel.svg?text=${values.name.charAt(0).toUpperCase()}`;

  let image: string;
  if (values.image && values.image.startsWith("data:image/")) {
    image = (await uploadImageToCloudinary(values.image)) || defaultImage;
  } else {
    image = values.image || defaultImage;
  }

  const promise = $fetch("/api/workspace/create", {
    method: "POST",
    body: { name: values.name, image },
  });
  toast.promise(promise, {
    loading: "Creating workspace...",
    success: "Successfully created a new workspace!",
    error: (err: any) =>
      err?.response?._data?.statusMessage ??
      err?.message ??
      "Couldn't create the workspace, please try again.",
    desc: "Redirecting you to your workspace",
    errorDesc: "Check the details and try again",
    position: "top-center",
  });
  promise
    .then((res: any) => {
      if (res?.workspace) {
        onClose();
        queryClient.invalidateQueries({ queryKey: ["workspaces"] });
        refreshNuxtData(["mobile_workspaces"]);
        navigateTo(`/workspace/${res.workspace.id}/dashboard`);
      }
    })
    .catch(() => {})
    .finally(() => {
      isCreatingWorkspace.value = false;
    });
});
</script>

<template>
  <form class="space-y-4" @submit.prevent="onCreateWorkspace">
    <FormField v-slot="{ componentField, meta }" name="name">
      <FormItem class="space-y-1">
        <FormLabel class="text-onboarding-text-300 text-sm font-medium"> Name </FormLabel>
        <FormControl>
          <div
            :class="
              cn('rounded-md border', meta.touched && form.errors.value.name && 'border-red-300')
            "
          >
            <input
              type="text"
              placeholder="e.g Acme Inc"
              v-bind="componentField"
              class="placeholder:text-custom-text-400 border-custom-border-200 placeholder:text-onboarding-text-400 block h-11.5 w-full rounded-md border-0 bg-transparent px-3 py-2 text-sm focus:bg-none focus:outline-none active:bg-transparent"
            />
          </div>
        </FormControl>
        <div v-if="meta.touched" class="flex items-center gap-1 px-0.5 text-xs text-red-600">
          <Icon v-if="form.errors.value.name" name="lucide:circle-alert" class="size-5" />
          <FormMessage />
        </div>
      </FormItem>
    </FormField>
    <FormField v-slot="{ value, handleChange }" name="image">
      <FormItem class="space-y-1">
        <FormLabel class="text-onboarding-text-300 text-sm font-medium"> Image </FormLabel>
        <FormControl>
          <FileUpload :value="value as string" :handle-change="handleChange" />
          <div class="my-1.5 text-center text-xs text-muted-foreground">
            Don't think hard, a default image would be added for you.
          </div>
        </FormControl>
      </FormItem>
    </FormField>
    <div class="flex flex-col items-center gap-2">
      <button
        type="submit"
        :disabled="isSubmitting || isUploadingImg"
        :class="
          cn(
            'flex w-full items-center justify-center gap-1.5 rounded px-5 py-2 text-sm font-medium whitespace-nowrap text-white transition-all',
            {
              'cursor-pointer bg-brand focus:bg-brand-secondary':
                form.controlledValues.value.name && !form.errors.value.name,
              'cursor-not-allowed bg-brand-secondary opacity-50':
                !form.controlledValues.value.name || form.errors.value.name || isCreatingWorkspace,
            },
          )
        "
      >
        <Loader v-if="isCreatingWorkspace" class="size-5 animate-spin" />
        <ArrowRight v-else class="size-4" />
        Create Workspace
      </button>
      <Button
        type="button"
        :disabled="isCreatingWorkspace || isUploadingImg"
        variant="ghost"
        class="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded px-5 py-2 text-sm font-medium whitespace-nowrap transition-all"
        @click="onClose"
      >
        Cancel
      </Button>
    </div>
  </form>
</template>
