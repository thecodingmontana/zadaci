<script setup lang="ts">
import { X } from "@lucide/vue";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";

const props = defineProps<{
  updateWorkspaceAvatar: (avatarStr: string) => void;
  isCreateWorkspace: boolean;
}>();

const DEFAULT_AVATAR =
  "https://res.cloudinary.com/dfa1yoc1v/image/upload/v1743189693/avatars/thumbs-1743189589089_sfuswl.svg";

const fileInput = ref<HTMLInputElement | null>(null);
const files = ref<FileList | null>(null);
const fileName = ref<string | null>(null);
const previewUrl = ref<string | null>(null);

watch(files, (newFiles) => {
  if (newFiles && newFiles.length > 0) {
    fileName.value = newFiles[0]?.name ?? null;
    previewUrl.value = newFiles[0] ? URL.createObjectURL(newFiles[0]) : null;
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result && typeof reader.result === "string") {
        props.updateWorkspaceAvatar(reader.result);
      }
    };
    if (newFiles[0]) {
      reader.readAsDataURL(newFiles[0]);
    }
  }
});

function handleRemove() {
  fileName.value = null;
  previewUrl.value = null;
  if (fileInput.value) fileInput.value.value = "";
}
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-1">
    <div class="relative">
      <div class="size-14 overflow-hidden">
        <img
          class="absolute inset-0 size-full rounded-full border border-purple-200 object-cover"
          :src="previewUrl || DEFAULT_AVATAR"
          alt="Preview of uploaded workspace image"
        />
      </div>
      <Button
        v-if="previewUrl"
        size="icon"
        variant="destructive"
        class="absolute -top-1 -right-1 size-6 rounded-full border-2 border-background"
        aria-label="Remove image"
        @click="handleRemove"
      >
        <X :size="16" />
      </Button>
    </div>
    <Label
      for="img_workspace"
      class="cursor-pointer pt-1 text-sm font-medium hover:text-muted-foreground"
    >
      Choose image
      <input
        id="img_workspace"
        ref="fileInput"
        type="file"
        class="hidden"
        accept="image/*"
        aria-label="Upload workspace image"
        :disabled="props.isCreateWorkspace"
        @change="(e: Event) => (files = (e.target as HTMLInputElement).files)"
      />
    </Label>
  </div>
</template>
