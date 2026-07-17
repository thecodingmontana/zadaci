<script setup lang="ts">
import { ImageUp, X } from "@lucide/vue";
import { Label } from "~/components/ui/label";
import { toast } from "~/lib/toast";

const props = defineProps<{
  handleChange: (value: string) => void;
  value: string | undefined;
}>();
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const fileInput = ref<HTMLInputElement | null>(null);
const previewUrl = ref<string | null>(null);

function handleFilePick(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files || !input.files[0]) return;

  const file = input.files[0];

  if (!ALLOWED_TYPES.includes(file.type)) {
    toast.error("Invalid file type", {
      desc: "Only JPEG, PNG, and WebP images are allowed.",
      position: "top-center",
    });
    if (fileInput.value) fileInput.value.value = "";
    return;
  }

  if (file.size > MAX_SIZE) {
    toast.error("File too large", {
      desc: "Maximum file size is 5 MB. Please choose a smaller image.",
      position: "top-center",
    });
    if (fileInput.value) fileInput.value.value = "";
    return;
  }

  previewUrl.value = URL.createObjectURL(file);

  const reader = new FileReader();
  reader.onload = () => {
    if (reader.result && typeof reader.result === "string") {
      props.handleChange(reader.result);
    }
  };
  reader.readAsDataURL(file);
}

function clearImage() {
  previewUrl.value = null;
  props.handleChange("");
  if (fileInput.value) fileInput.value.value = "";
}
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <div v-if="previewUrl" class="relative">
      <img
        class="mx-auto size-20 rounded-full border-2 border-muted-foreground object-cover"
        :src="previewUrl"
        alt="Preview"
      />
      <button
        type="button"
        aria-label="Remove image"
        class="absolute -top-1 -right-1 rounded-full bg-rose-500 p-1 text-white shadow-sm hover:bg-rose-400"
        @click="clearImage"
      >
        <X class="size-4" />
      </button>
    </div>
    <div v-else class="w-full">
      <Label
        for="imageUrl"
        class="mt-2 flex justify-center rounded-lg border border-dashed border-gray-900/25 p-3 hover:cursor-pointer dark:border-gray-500"
      >
        <div class="text-center">
          <ImageUp class="mx-auto size-6 text-gray-300" aria-hidden="true" />
          <div class="mt-4 flex items-center justify-center text-sm leading-6">
            <div
              class="relative cursor-pointer rounded-md bg-white font-semibold focus-within:ring-2 focus-within:ring-gray-600 focus-within:ring-offset-2 focus-within:outline-none hover:text-gray-500 dark:bg-transparent dark:text-white dark:focus-within:ring-0"
            >
              <span>Click to upload a file</span>
              <input
                id="imageUrl"
                ref="fileInput"
                name="imageUrl"
                type="file"
                class="sr-only"
                accept="image/jpeg,image/png,image/webp"
                @change="handleFilePick"
              />
            </div>
          </div>
          <p class="text-xs leading-5 text-muted-foreground">PNG, JPG or WebP (max 5 MB)</p>
        </div>
      </Label>
    </div>
  </div>
</template>
