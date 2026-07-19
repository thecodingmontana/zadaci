<script setup lang="ts">
import { ArrowRight, Loader2 } from "@lucide/vue";
import { useForm } from "vee-validate";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { useInvalidateOnboardingDetails } from "~/composables/use-onboarding-details";
import { toast } from "~/lib/toast";
import { onboardingProfileSchema } from "~/types";
import Password from "./password.vue";
import UserAvatar from "./user-avatar.vue";

const props = defineProps<{
  onSetCurrentStep: (step: number) => void;
}>();

const invalidateOnboardingDetails = useInvalidateOnboardingDetails();

const isUpdatingProfile = ref(false);
const isUploadingImage = ref(false);
const password = ref("");
const selectedAvatar = ref<string | null>(null);

function updatePassword(passStr: string) {
  password.value = passStr;
}

const form = useForm({
  validationSchema: onboardingProfileSchema,
});

function updateUserAvatar(avatarStr: string) {
  selectedAvatar.value = avatarStr;
}

const { user, fetch: fetchUserSession } = useUserSession();

onMounted(() => {
  if (user.value?.username) {
    form.setFieldValue("first_name", user.value.username.split(" ")[0]);
    form.setFieldValue("last_name", user.value.username.split(" ")[1]);
  }
});

async function uploadImageToCloudinary(image: string): Promise<string | undefined> {
  isUploadingImage.value = true;
  try {
    const res = await $fetch("/api/workspace/upload", {
      method: "POST",
      body: { image },
    });
    return res.url;
  } catch {
    return undefined;
  } finally {
    isUploadingImage.value = false;
  }
}

const onSubmit = form.handleSubmit(async (values) => {
  isUpdatingProfile.value = true;

  let avatar: string = user.value ? user.value.avatar : "";
  if (selectedAvatar.value) {
    avatar = (await uploadImageToCloudinary(selectedAvatar.value)) || avatar;
  }

  const promise = $fetch("/api/workspace/user/update", {
    method: "POST",
    body: {
      username: `${values.first_name} ${values.last_name}`,
      avatar,
      password: password.value,
    },
  });
  toast.promise(promise, {
    loading: "Updating profile...",
    success: "Profile updated successfully",
    error: (err: any) =>
      err?.response?._data?.message ??
      err?.message ??
      "Couldn't update your profile, please try again.",
    position: "top-center",
  });
  promise
    .then(async () => {
      await fetchUserSession();
      await invalidateOnboardingDetails();
      props.onSetCurrentStep(2);
    })
    .catch(() => {})
    .finally(() => {
      isUpdatingProfile.value = false;
    });
});
</script>

<template>
  <form class="mx-auto mt-2 w-full space-y-4 sm:w-96" @submit="onSubmit">
    <UserAvatar :is-updating-profile="isUpdatingProfile" :update-user-avatar="updateUserAvatar" />
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField v-slot="{ componentField }" name="first_name">
        <FormItem class="self-start">
          <FormLabel
            class="text-sm font-medium after:ml-0.5 after:text-red-500 after:content-['*']"
          >
            Firstname
          </FormLabel>
          <FormControl>
            <Input
              type="text"
              placeholder="John"
              v-bind="componentField"
              :disabled="form.isSubmitting.value || isUpdatingProfile"
              class="placeholder:text-custom-text-400 border-onboarding-border-100 block w-full rounded-md border-[0.5px] bg-transparent px-3 py-2 text-sm focus:outline-none"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>
      <FormField v-slot="{ componentField }" name="last_name">
        <FormItem class="self-start">
          <FormLabel
            class="text-sm font-medium after:ml-0.5 after:text-red-500 after:content-['*']"
          >
            Lastname
          </FormLabel>
          <FormControl>
            <Input
              type="text"
              placeholder="Doe"
              :disabled="form.isSubmitting.value || isUpdatingProfile"
              v-bind="componentField"
              class="placeholder:text-custom-text-400 border-onboarding-border-100 block w-full rounded-md border-[0.5px] bg-transparent px-3 py-2 text-sm focus:outline-none"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>
    </div>
    <Password :is-updating-profile="isUpdatingProfile" :update-password="updatePassword" />
    <button
      type="submit"
      :disabled="isUpdatingProfile"
      class="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded bg-brand px-5 py-2 text-sm font-medium whitespace-nowrap text-white transition-all hover:bg-brand-secondary focus:bg-brand-secondary"
    >
      <Loader2 v-if="isUpdatingProfile" class="size-5 animate-spin" />
      <ArrowRight v-else class="size-4" />
      Continue
    </button>
  </form>
</template>
