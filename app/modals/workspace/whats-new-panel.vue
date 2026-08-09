<script setup lang="ts">
import type { ChangelogRelease } from "~~/changelog/entries";
import { changelogReleases } from "~~/changelog/entries";
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

interface ReleaseGroup {
  date: string;
  releases: ChangelogRelease[];
}

function groupReleasesByDate(releases: ChangelogRelease[]): ReleaseGroup[] {
  const groups: ReleaseGroup[] = [];
  for (const release of releases) {
    const last = groups[groups.length - 1];
    if (last && last.date === release.date) {
      last.releases.push(release);
    } else {
      groups.push({ date: release.date, releases: [release] });
    }
  }
  return groups;
}

const releaseGroups = groupReleasesByDate(changelogReleases);
const latestGroup = releaseGroups[0];
const previousGroups = computed(() => releaseGroups.slice(1));

const categoryMeta: Record<
  ChangelogRelease["sections"][number]["category"],
  { icon: string; colorClass: string; label: string }
> = {
  "New Features": {
    icon: "hugeicons:sparkles",
    colorClass: "text-emerald-500",
    label: "New Features",
  },
  Improvements: { icon: "solar:settings-linear", colorClass: "text-brand", label: "Improvements" },
  "Bug Fixes": { icon: "solar:bug-outline", colorClass: "text-rose-500", label: "Bug Fixes" },
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
            <Icon name="hugeicons:gift" class="text-brand" size="20" />
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
          class="mr-5 cursor-pointer bg-brand text-white hover:bg-brand-secondary"
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
              <Icon name="twemoji:sparkles" size="18" />
              New updates
            </p>

            <div class="space-y-5">
              <!-- Latest release group -->
              <div>
                <div class="mb-2 flex items-baseline gap-2">
                  <h4 class="text-sm font-bold">Zadaci {{ latestGroup.releases[0].version }}</h4>
                  <span class="text-xs text-muted-foreground">
                    {{ formatDate(latestGroup.date) }}
                  </span>
                </div>
                <div
                  v-for="release in latestGroup.releases"
                  :key="release.version"
                  class="space-y-3"
                >
                  <div v-if="latestGroup.releases.length > 1" class="mb-1 text-xs font-semibold">
                    v{{ release.version }}
                  </div>
                  <div v-for="section in release.sections" :key="section.category">
                    <p class="mb-1 flex items-center gap-1.5 text-sm font-semibold">
                      <Icon
                        :name="categoryMeta[section.category].icon"
                        size="18"
                        :class="[categoryMeta[section.category].colorClass]"
                      />
                      {{ categoryMeta[section.category].label }}:
                    </p>
                    <ul class="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      <li v-for="item in section.items" :key="item">{{ item }}</li>
                    </ul>
                  </div>
                </div>
              </div>

              <!-- Divider when previous updates exist -->
              <div v-if="previousGroups.length > 0" class="border-t" />

              <!-- Previous updates -->
              <div v-if="previousGroups.length > 0">
                <p
                  class="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  <Icon name="twemoji:alarm-clock" size="18" />
                  Previous updates
                </p>
                <div class="space-y-5">
                  <div v-for="group in previousGroups" :key="group.date">
                    <div class="mb-2 flex items-baseline gap-2">
                      <h4 class="text-sm font-bold">Zadaci {{ group.releases[0].version }}</h4>
                      <span class="text-xs text-muted-foreground">
                        {{ formatDate(group.date) }}
                      </span>
                    </div>
                    <div v-for="release in group.releases" :key="release.version" class="space-y-3">
                      <div v-if="group.releases.length > 1" class="mb-1 text-xs font-semibold">
                        v{{ release.version }}
                      </div>
                      <div v-for="section in release.sections" :key="section.category">
                        <p class="mb-1 flex items-center gap-1.5 text-sm font-semibold">
                          <Icon
                            :name="categoryMeta[section.category].icon"
                            size="18"
                            :class="[categoryMeta[section.category].colorClass]"
                          />
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
