<script lang="ts" setup>
import { toast } from "~/lib/toast";

async function copyEmail() {
  const email = "thecodingmontana@gmail.com";
  try {
    await navigator.clipboard.writeText(email);
    toast.success("Email copied", {
      desc: email,
      position: "top-center",
    });
  } catch {
    toast.error("Couldn't copy email", {
      desc: `Please copy it manually: ${email}`,
      position: "top-center",
    });
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-[#fafafa] px-6 dark:bg-[#08080a]">
    <div class="flex max-w-md flex-col items-center gap-6 text-center">
      <span
        class="grid size-16 place-items-center rounded-full border border-black/10 bg-white text-black/70 dark:border-white/10 dark:bg-white/5 dark:text-white/70"
      >
        <Icon name="lucide:construction" size="30" />
      </span>

      <div class="flex flex-col gap-2">
        <h1 class="text-lg font-semibold text-black dark:text-white">We'll be right back</h1>
        <p class="text-sm leading-relaxed text-black/60 dark:text-white/50">
          Hey, I know you missed us — I'm currently working hard to port this project into something
          new. Kindly sit back and be patient, my apologies.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium text-black/70 transition hover:bg-black/5 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5"
          @click="copyEmail"
        >
          <Icon name="solar:mailbox-linear" class="size-4" />
          Contact me
        </button>
      </div>
    </div>
  </div>
</template>
