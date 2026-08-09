<script setup lang="ts">
import type { ChangelogRelease } from "~~/changelog/entries";
import { changelogReleases, getLatestChangelogRelease } from "~~/changelog/entries";
import { Button } from "~/components/ui/button";
import { ScrollArea, ScrollBar } from "~/components/ui/scroll-area";
import { useWhatsNew } from "~/composables/use-whats-new";
import { useModalStore } from "~/stores/use-modal-store";

const modalStore = useModalStore();
const { markAsSeen } = useWhatsNew();

const isModalOpen = computed(() => {
  return modalStore?.type === "whatsNew" && modalStore?.isOpen;
});

const onClose = () => {
  modalStore?.onClose();
  modalStore?.setIsOpen(false);
};

watch(isModalOpen, async (open) => {
  if (open) {
    await nextTick();
    await markAsSeen();
  }
});

function openFeedback() {
  modalStore?.onClose();
  modalStore?.setIsOpen(false);
  nextTick(() => {
    modalStore?.onOpen("feedback");
    modalStore?.setIsOpen(true);
  });
}

const latestRelease = getLatestChangelogRelease();
const previousReleases = computed(() => changelogReleases.slice(1));

const categoryMeta: Record<
  ChangelogRelease["sections"][number]["category"],
  { icon: string; label: string }
> = {
  "New Features": { icon: "twemoji:sparkles", label: "New Features" },
  Improvements: { icon: "twemoji:gear", label: "Improvements" },
  "Bug Fixes": { icon: "twemoji:beetle", label: "Bug Fixes" },
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
</script>

<template>
  <Dialog :open="isModalOpen" @update:open="onClose">
    <DialogContent class="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-lg dark:bg-[#1d1d1d]">
      <!-- Header -->
      <div class="flex items-start justify-between gap-3 border-b p-5">
        <div class="flex items-start gap-3">
          <div class="grid size-10 shrink-0 place-items-center rounded-lg bg-muted">
            <Icon name="twemoji:wrapped-gift" class="size-5" />
          </div>
          <div>
            <DialogTitle class="text-lg font-semibold">What's new</DialogTitle>
            <DialogDescription class="sr-only">
              Recent updates and improvements to Zadaci
            </DialogDescription>
          </div>
        </div>
        <Button
          size="sm"
          class="cursor-pointer bg-brand text-white hover:bg-brand-secondary"
          @click="openFeedback"
        >
          Share feedback
        </Button>
      </div>

      <!-- Body -->
      <ScrollArea class="max-h-[85vh] flex-1 overflow-y-auto">
        <div class="space-y-6 p-5">
          <!-- New updates -->
          <section>
            <p
              class="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
            >
              <Icon name="twemoji:sparkles" class="size-3.5" />
              New updates
            </p>

            <div class="space-y-5">
              <!-- Latest release -->
              <div>
                <div class="mb-2 flex items-baseline gap-2">
                  <h4 class="text-sm font-bold">Zadaci {{ latestRelease.version }}</h4>
                  <span class="text-xs text-muted-foreground">
                    {{ formatDate(latestRelease.date) }}
                  </span>
                </div>
                <div class="space-y-3">
                  <div v-for="section in latestRelease.sections" :key="section.category">
                    <p class="mb-1 flex items-center gap-1.5 text-sm font-semibold">
                      <Icon :name="categoryMeta[section.category].icon" class="size-4" />
                      {{ categoryMeta[section.category].label }}:
                    </p>
                    <ul class="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      <li v-for="item in section.items" :key="item">{{ item }}</li>
                    </ul>
                  </div>
                </div>
              </div>

              <!-- Divider when previous releases exist -->
              <div v-if="previousReleases.length > 0" class="border-t" />

              <!-- Previous updates -->
              <div v-if="previousReleases.length > 0">
                <p
                  class="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  <Icon name="twemoji:alarm-clock" class="size-3.5" />
                  Previous updates
                </p>
                <div class="space-y-5">
                  <div v-for="release in previousReleases" :key="release.version">
                    <div class="mb-2 flex items-baseline gap-2">
                      <h4 class="text-sm font-bold">Zadaci {{ release.version }}</h4>
                      <span class="text-xs text-muted-foreground">
                        {{ formatDate(release.date) }}
                      </span>
                    </div>
                    <div class="space-y-3">
                      <div v-for="section in release.sections" :key="section.category">
                        <p class="mb-1 flex items-center gap-1.5 text-sm font-semibold">
                          <Icon :name="categoryMeta[section.category].icon" class="size-4" />
                          {{ categoryMeta[section.category].label }}:
                        </p>
                        <ul class="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                          <li v-for="item in section.items" :key="item">{{ item }}</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
        <ScrollBar />
      </ScrollArea>
    </DialogContent>
  </Dialog>
</template>
