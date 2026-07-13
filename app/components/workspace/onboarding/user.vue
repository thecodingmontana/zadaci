<script setup lang="ts">
import { LogOut } from "@lucide/vue";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useModalStore } from "~/stores/use-modal-store";

const { user } = useUserSession();
const modalStore = useModalStore();

function onOpenSignoutModal() {
  modalStore.setIsOpen(true);
  modalStore.onOpen("signout");
}

const initials = computed(() => {
  const name = user.value?.username?.trim();
  if (!name) return "??";
  const parts = name.split(" ").filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return `${first}${second}`.toUpperCase() || "??";
});
</script>

<template>
  <div class="flex w-full shrink-0 justify-end">
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <button
          type="button"
          class="z-10 flex cursor-pointer items-center gap-x-2 rounded-lg px-1.5 py-1 transition hover:bg-black/5 dark:hover:bg-white/5"
        >
          <Avatar class="size-8 rounded-lg">
            <AvatarImage
              :src="user?.avatar || '/default-avatar.png'"
              :alt="user?.username || 'User avatar'"
            />
            <AvatarFallback class="rounded-lg">
              {{ initials }}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent class="w-56 rounded-lg" side="bottom" align="end" :side-offset="4">
        <DropdownMenuLabel class="p-0 font-normal">
          <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar class="size-8 rounded-lg">
              <AvatarImage
                :src="user?.avatar || '/default-avatar.png'"
                :alt="user?.username || 'User avatar'"
              />
              <AvatarFallback class="rounded-lg">
                {{ initials }}
              </AvatarFallback>
            </Avatar>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-medium">{{ user?.username || "Unnamed" }}</span>
              <span class="truncate text-xs text-muted-foreground">{{ user?.email }}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          class="focus:cursor-pointer focus:bg-rose-50 focus:text-rose-600"
          @click="onOpenSignoutModal"
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
