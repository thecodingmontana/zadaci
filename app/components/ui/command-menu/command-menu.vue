<script setup lang="ts">
import type { CommandGroup, CommandPerson, CommandRow } from "./types";
import { useHotkey } from "@tanstack/vue-hotkeys";
import { useMediaQuery } from "@vueuse/core";
import { AnimatePresence, motion } from "motion-v";
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { Input } from "~/components/ui/input";
import { Kbd, KbdGroup } from "~/components/ui/kbd";

const props = withDefaults(
  defineProps<{
    groups: CommandGroup[];
    hotkey?: string | null;
    placeholder?: string;
    accent?: string;
  }>(),
  {
    hotkey: "Mod+K",
    placeholder: "Search people, projects, actions",
    accent: "#f0883e",
  },
);

const emit = defineEmits<{
  run: [row: CommandRow];
}>();

const open = defineModel<boolean>("open", { default: false });

const query = ref("");
const sel = ref(0);
const receipt = ref<string | null>(null);
const listEl = ref<HTMLDivElement | null>(null);

const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

const EASE = [0.23, 1, 0.32, 1] as const;
const SEARCH_INPUT_ID = "cmk-search-input";

const PRESENCE: Record<CommandPresence, { color: string; arc: number; label: string }> = {
  online: { color: "#4FAE7E", arc: 1, label: "online" },
  busy: { color: "#D96A5F", arc: 0.82, label: "busy" },
  away: { color: "#D9A13F", arc: 0.45, label: "away" },
};
type CommandPresence = CommandPerson["presence"];

const AVATAR_TINT = ["#f0883e", "#3ecf8e", "#22d3ee", "#b06bff", "#f0463a"];

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function hashName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function tintFor(name: string) {
  return AVATAR_TINT[hashName(name) % AVATAR_TINT.length];
}

function matchParts(text: string, q: string) {
  if (!q) return { before: text, match: "", after: "" };
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return { before: text, match: "", after: "" };
  return {
    before: text.slice(0, i),
    match: text.slice(i, i + q.length),
    after: text.slice(i + q.length),
  };
}

function ringDash(value: number) {
  const c = 2 * Math.PI * 5.5;
  return `${c * value} ${c}`;
}

function presenceDash(arc: number) {
  const c = 2 * Math.PI * 14;
  return `${c * arc} ${c}`;
}

const sections = computed<CommandGroup[]>(() => {
  const q = query.value.trim().toLowerCase();
  const match = (row: CommandRow) => {
    if (!q) return true;
    const hay =
      row.kind === "person"
        ? `${row.name} ${row.role}`
        : row.kind === "project"
          ? `${row.name} ${row.meta}`
          : row.label;
    return hay.toLowerCase().includes(q);
  };
  return props.groups
    .map((g) => ({ title: g.title, rows: g.rows.filter(match) }))
    .filter((g) => g.rows.length > 0);
});

const flat = computed(() => sections.value.flatMap((s) => s.rows));
const current = computed(() => flat.value[sel.value]);
const rowIndex = (row: CommandRow) => flat.value.indexOf(row);

const onlinePeople = computed(() =>
  props.groups
    .flatMap((g) => g.rows)
    .filter((r): r is CommandPerson => r.kind === "person" && r.presence === "online"),
);

watch(query, () => {
  sel.value = 0;
});

watch(sel, () => {
  nextTick(() => {
    listEl.value?.querySelector('[data-sel="true"]')?.scrollIntoView({
      block: "nearest",
      behavior: prefersReducedMotion.value ? "auto" : "smooth",
    });
  });
});

function close() {
  open.value = false;
  query.value = "";
  sel.value = 0;
  receipt.value = null;
}

function reveal() {
  query.value = "";
  sel.value = 0;
  receipt.value = null;
  open.value = true;
}

useHotkey(props.hotkey ?? "Mod+K", () => (open.value ? close() : reveal()), {
  enabled: computed(() => props.hotkey !== null),
  preventDefault: true,
});

useHotkey("Escape", close, { enabled: open });

watch(open, (v) => {
  if (v) {
    document.documentElement.style.overflow = "hidden";
    nextTick(() => document.getElementById(SEARCH_INPUT_ID)?.focus());
  } else {
    document.documentElement.style.overflow = "";
  }
});

onBeforeUnmount(() => {
  document.documentElement.style.overflow = "";
});

function run(row: CommandRow) {
  emit("run", row);
  const text =
    row.kind === "person"
      ? `opening chat with ${row.name.split(" ")[0]}`
      : row.kind === "project"
        ? `jumping to ${row.name}`
        : row.receipt;
  receipt.value = text;
  window.setTimeout(close, 700);
}

function onListKeydown(e: KeyboardEvent) {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    sel.value = Math.min(flat.value.length - 1, sel.value + 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    sel.value = Math.max(0, sel.value - 1);
  } else if (e.key === "Enter" && current.value && !receipt.value) {
    e.preventDefault();
    run(current.value);
  }
}
</script>

<template>
  <AnimatePresence>
    <div
      v-if="open"
      class="cmk-root fixed inset-0 z-100 flex items-center justify-center px-4"
      :style="{ '--cmk-accent': accent }"
      role="dialog"
      aria-modal="true"
      aria-label="Command menu"
    >
      <motion.button
        aria-label="Close"
        class="absolute inset-0 cursor-default"
        style="background: var(--cmk-scrim)"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1 }"
        :exit="{ opacity: 0 }"
        :transition="{ duration: 0.18, ease: 'easeOut' }"
        @click="close"
      />

      <motion.div
        class="relative w-full max-w-[600px]"
        style="transform-origin: 50% 0%"
        :initial="
          prefersReducedMotion
            ? { opacity: 0 }
            : { opacity: 0, scale: 0.97, y: 10, filter: 'blur(6px)' }
        "
        :animate="{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }"
        :exit="
          prefersReducedMotion
            ? { opacity: 0 }
            : { opacity: 0, scale: 0.98, y: 6, filter: 'blur(3px)' }
        "
        :transition="{ duration: 0.22, ease: EASE }"
      >
        <motion.div
          aria-hidden="true"
          class="absolute -top-[14px] left-1/2 h-6 w-[86%] -translate-x-1/2 rounded-t-[18px]"
          style="background: var(--cmk-layer-2)"
          :initial="prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }"
          :animate="{ opacity: 0.55, y: 0 }"
          :exit="{ opacity: 0 }"
          :transition="{ duration: 0.24, delay: 0.1, ease: EASE }"
        />
        <motion.div
          aria-hidden="true"
          class="absolute -top-[7px] left-1/2 h-6 w-[94%] -translate-x-1/2 rounded-t-[20px]"
          style="background: var(--cmk-layer-1)"
          :initial="prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }"
          :animate="{ opacity: 0.9, y: 0 }"
          :exit="{ opacity: 0 }"
          :transition="{ duration: 0.22, delay: 0.06, ease: EASE }"
        />

        <div
          class="relative rounded-[24px] p-[6px]"
          style="background: var(--cmk-bezel); box-shadow: var(--cmk-bezel-shadow)"
        >
          <div
            class="overflow-hidden rounded-[19px]"
            style="background: var(--cmk-panel); box-shadow: var(--cmk-panel-shadow)"
            @keydown="onListKeydown"
          >
            <div class="p-3 pb-0">
              <div
                class="flex items-center gap-3 rounded-[12px] px-3.5 py-2.5"
                style="background: var(--cmk-well); box-shadow: var(--cmk-well-shadow)"
              >
                <Icon
                  name="hugeicons:search-01"
                  size="16"
                  class="shrink-0"
                  :style="{ color: query ? 'var(--cmk-text)' : 'var(--cmk-faint)' }"
                />
                <Input
                  :id="SEARCH_INPUT_ID"
                  v-model="query"
                  :placeholder="placeholder"
                  aria-label="Search"
                  autocomplete="off"
                  class="h-auto flex-1 border-0 bg-transparent p-0 text-[13.5px] font-medium shadow-none focus-visible:ring-0"
                  :style="{ color: 'var(--cmk-text)', caretColor: 'var(--cmk-accent)' }"
                />
                <span class="text-[10px] tabular-nums" style="color: var(--cmk-faint)">
                  {{ query ? `${flat.length} results` : "" }}
                </span>
                <Kbd>esc</Kbd>
              </div>
            </div>

            <div
              ref="listEl"
              role="listbox"
              aria-label="Results"
              class="max-h-[356px] overflow-y-auto px-3 pt-1 pb-4"
              style="
                mask-image: linear-gradient(
                  to bottom,
                  transparent,
                  black 8px,
                  black calc(100% - 20px),
                  transparent
                );
              "
            >
              <div class="relative">
                <div v-if="flat.length === 0" class="px-2 py-8 text-center">
                  <p class="text-[12.5px] font-medium" style="color: var(--cmk-mute)">
                    nothing for &ldquo;{{ query }}&rdquo;
                  </p>
                  <p class="mt-1 text-[11px]" style="color: var(--cmk-faint)">
                    try a person, a project, or an action
                  </p>
                </div>

                <div v-for="section in sections" :key="section.title" class="mt-2.5">
                  <div class="flex items-center justify-between px-2 pb-1">
                    <p
                      class="text-[10px] font-semibold tracking-[0.08em] uppercase"
                      style="color: var(--cmk-faint)"
                    >
                      {{ section.title }}
                    </p>
                    <p class="text-[9.5px] tabular-nums" style="color: var(--cmk-faint)">
                      {{ section.rows.length }}
                    </p>
                  </div>

                  <button
                    v-for="row in section.rows"
                    :key="row.id"
                    role="option"
                    :aria-selected="rowIndex(row) === sel"
                    :data-sel="rowIndex(row) === sel"
                    class="block w-full rounded-[11px] px-2.5 py-[8px] text-left transition-[background-color,box-shadow] duration-150 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
                    :style="{
                      background: rowIndex(row) === sel ? 'var(--cmk-well)' : 'transparent',
                      boxShadow: rowIndex(row) === sel ? 'var(--cmk-sel-shadow)' : 'none',
                      outlineColor: 'var(--cmk-accent)',
                    }"
                    @mousemove="sel = rowIndex(row)"
                    @click="run(row)"
                  >
                    <span
                      class="flex items-center gap-3.5 transition-transform duration-200"
                      style="transition-timing-function: cubic-bezier(0.23, 1, 0.32, 1)"
                      :style="{
                        transform:
                          rowIndex(row) === sel && !prefersReducedMotion
                            ? 'translateX(3px)'
                            : 'translateX(0px)',
                      }"
                    >
                      <span class="relative">
                        <span
                          v-if="row.kind === 'person'"
                          class="relative inline-block size-[26px] shrink-0"
                        >
                          <img
                            v-if="row.avatar"
                            :src="row.avatar"
                            alt=""
                            width="26"
                            height="26"
                            draggable="false"
                            class="size-[26px] rounded-full object-cover"
                          />
                          <span
                            v-else
                            class="grid size-[26px] place-items-center rounded-full text-[10px] font-semibold"
                            :style="{ background: tintFor(row.name), color: '#141612' }"
                          >
                            {{ initials(row.name) }}
                          </span>
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 34 34"
                            class="absolute -inset-[4px] size-[34px]"
                          >
                            <circle
                              cx="17"
                              cy="17"
                              r="14"
                              fill="none"
                              :stroke="PRESENCE[row.presence].color"
                              stroke-width="1.75"
                              stroke-linecap="round"
                              :stroke-dasharray="presenceDash(PRESENCE[row.presence].arc)"
                              transform="rotate(-90 17 17)"
                              opacity="0.9"
                            />
                          </svg>
                        </span>

                        <span
                          v-else-if="row.kind === 'project'"
                          aria-hidden="true"
                          class="block size-[26px] shrink-0 rounded-[8px]"
                          :style="{
                            background: `linear-gradient(135deg, var(--cmk-tile-lit) 28%, ${row.gradient[0]} 90%, ${row.gradient[1]} 140%)`,
                            boxShadow: 'var(--cmk-tile-shadow)',
                          }"
                        />

                        <span
                          v-else
                          aria-hidden="true"
                          class="flex size-[26px] shrink-0 items-center justify-center rounded-[8px]"
                          style="
                            color: var(--cmk-mute);
                            background: var(--cmk-chip-bg);
                            border: 1px solid var(--cmk-chip-border);
                            box-shadow: var(--cmk-chip-shadow);
                          "
                        >
                          <Icon :name="row.glyph" size="14" />
                        </span>
                      </span>

                      <span class="relative min-w-0 flex-1">
                        <span
                          class="block truncate text-[13px] leading-tight font-medium"
                          style="color: var(--cmk-text)"
                        >
                          <template
                            v-if="
                              matchParts(row.kind === 'action' ? row.label : row.name, query.trim())
                                .match
                            "
                          >
                            {{
                              matchParts(row.kind === "action" ? row.label : row.name, query.trim())
                                .before
                            }}<span
                              class="rounded-[3px] px-px"
                              style="background: var(--cmk-hl-bg); color: var(--cmk-hl-text)"
                              >{{
                                matchParts(
                                  row.kind === "action" ? row.label : row.name,
                                  query.trim(),
                                ).match
                              }}</span
                            >{{
                              matchParts(row.kind === "action" ? row.label : row.name, query.trim())
                                .after
                            }}
                          </template>
                          <template v-else>
                            {{ row.kind === "action" ? row.label : row.name }}
                          </template>
                        </span>
                        <span
                          class="block truncate text-[10.5px] leading-tight transition-colors duration-200"
                          :style="{
                            color: rowIndex(row) === sel ? 'var(--cmk-mute)' : 'var(--cmk-faint)',
                          }"
                        >
                          <template v-if="row.kind === 'person'">
                            {{ row.role }} ·
                            <span :style="{ color: PRESENCE[row.presence].color }">{{
                              PRESENCE[row.presence].label
                            }}</span>
                          </template>
                          <template v-else-if="row.kind === 'project'">{{ row.meta }}</template>
                          <template v-else>{{ row.description ?? "runs instantly" }}</template>
                        </span>
                      </span>

                      <span class="relative flex items-center gap-2">
                        <template v-if="row.kind === 'project'">
                          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                            <defs>
                              <linearGradient
                                :id="`cmk-ring-${row.id}`"
                                x1="0"
                                y1="0"
                                x2="1"
                                y2="1"
                              >
                                <stop offset="0%" :stop-color="row.gradient[0]" />
                                <stop offset="100%" :stop-color="row.gradient[1]" />
                              </linearGradient>
                            </defs>
                            <circle
                              cx="8"
                              cy="8"
                              r="5.5"
                              fill="none"
                              stroke="var(--cmk-ring-track)"
                              stroke-width="2"
                            />
                            <circle
                              cx="8"
                              cy="8"
                              r="5.5"
                              fill="none"
                              :stroke="`url(#cmk-ring-${row.id})`"
                              stroke-width="2"
                              stroke-linecap="round"
                              :stroke-dasharray="ringDash(row.progress)"
                              transform="rotate(-90 8 8)"
                            />
                          </svg>
                          <span
                            class="w-7 text-right text-[9.5px] tabular-nums"
                            style="color: var(--cmk-faint)"
                          >
                            {{ Math.round(row.progress * 100) }}%
                          </span>
                        </template>
                        <Kbd>{{ row.kind === "person" ? "@" : row.shortcut }}</Kbd>
                      </span>
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div
              class="flex h-11 items-center justify-between px-4"
              style="background: var(--cmk-footer); border-top: 1px solid var(--cmk-hairline)"
            >
              <AnimatePresence mode="wait">
                <motion.p
                  v-if="receipt"
                  key="receipt"
                  :initial="{ opacity: 0 }"
                  :animate="{ opacity: 1 }"
                  :exit="{ opacity: 0 }"
                  :transition="{ duration: 0.1, ease: 'easeOut' }"
                  class="text-[11.5px] font-medium"
                  style="color: var(--cmk-text)"
                >
                  <span style="color: #3fb77a">✓</span> {{ receipt }}
                </motion.p>
                <motion.div
                  v-else
                  key="hints"
                  :initial="{ opacity: 0 }"
                  :animate="{ opacity: 1 }"
                  :exit="{ opacity: 0 }"
                  :transition="{ duration: 0.1, ease: 'easeOut' }"
                  class="flex items-center gap-3 text-[10.5px]"
                  style="color: var(--cmk-mute)"
                >
                  <KbdGroup><Kbd>↑</Kbd><Kbd>↓</Kbd></KbdGroup> move
                  <span class="flex items-center gap-1"><Kbd>↵</Kbd> open</span>
                </motion.div>
              </AnimatePresence>

              <div v-if="onlinePeople.length > 0" class="flex items-center gap-2">
                <span class="flex -space-x-1">
                  <template v-for="p in onlinePeople" :key="p.id">
                    <img
                      v-if="p.avatar"
                      :src="p.avatar"
                      alt=""
                      width="14"
                      height="14"
                      draggable="false"
                      class="size-3.5 rounded-full object-cover"
                      style="box-shadow: 0 0 0 1.5px var(--cmk-footer)"
                    />
                    <span
                      v-else
                      class="grid size-3.5 place-items-center rounded-full text-[7px] font-semibold"
                      :style="{
                        background: tintFor(p.name),
                        color: '#141612',
                        boxShadow: '0 0 0 1.5px var(--cmk-footer)',
                      }"
                    >
                      {{ initials(p.name) }}
                    </span>
                  </template>
                </span>
                <span class="text-[10px]" style="color: var(--cmk-faint)"
                  >{{ onlinePeople.length }} online</span
                >
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  </AnimatePresence>
</template>
