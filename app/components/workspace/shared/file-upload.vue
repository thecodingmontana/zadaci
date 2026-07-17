<script setup lang="ts">
import { ImageUp, RotateCw, X } from "@lucide/vue";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Label } from "~/components/ui/label";
import { toast } from "~/lib/toast";

const props = defineProps<{
  handleChange: (e: Event | unknown, shouldValidate?: boolean) => void;
  value: string | undefined;
  isUploadImg: boolean;
  setIsUploadImg: (payload: boolean) => void;
}>();

function handleImageUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files || !input.files[0]) return;

  const file = input.files[0];
  const reader = new FileReader();

  reader.onload = async () => {
    const result = reader.result;
    if (!result) return;

    const imgString = typeof result === "string" ? result : result.toString();

    try {
      props.setIsUploadImg(true);

      const res = await $fetch("/api/workspace/upload", {
        method: "POST",
        body: {
          image: imgString,
        },
      });

      props.handleChange(res.url);
    } catch (error: any) {
      const errorMessage = error?.response ? error.response._data?.statusMessage : error?.message;

      toast.error(errorMessage ?? "Couldn't upload the image, please try again.", {
        desc: "Check the file and try again",
        position: "top-center",
        action: {
          label: "Retry",
          icon: RotateCw,
          onClick: () => handleImageUpload(e),
        },
      });
    } finally {
      props.setIsUploadImg(false);
    }
  };

  reader.readAsDataURL(file);
}

function clearImage() {
  props.handleChange("");
}
</script>

<template>
  <div>
    <div
      v-if="props.isUploadImg"
      class="border-peer-primary mx-auto size-20 animate-pulse rounded-full bg-slate-200"
    />
    <div v-else-if="props.value" class="relative mx-auto size-20">
      <Avatar class="h-20 w-auto border-2 border-muted-foreground">
        <AvatarImage :src="props.value" alt="uploaded-img" />
        <AvatarFallback class="flex flex-col items-center">PS</AvatarFallback>
      </Avatar>
      <button
        type="button"
        aria-label="Remove image"
        class="absolute top-0 right-0 rounded-full bg-rose-500 p-1 text-white shadow-sm hover:bg-rose-400"
        @click="clearImage"
      >
        <X class="size-4" />
      </button>
    </div>
    <div v-else class="col-span-full">
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
                name="imageUrl"
                type="file"
                class="sr-only"
                accept="image/png, image/jpeg"
                @change="handleImageUpload"
              />
            </div>
          </div>
          <p class="text-xs leading-5 text-muted-foreground">PNG or JPG</p>
        </div>
      </Label>
    </div>
  </div>
</template>
