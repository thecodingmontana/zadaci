<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

const { user } = useUserSession();
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Avatar class="size-12 cursor-pointer rounded-lg">
        <AvatarImage :src="user?.avatar ?? ''" :alt="user?.username ?? ''" />
        <AvatarFallback class="rounded-lg"> ZA </AvatarFallback>
      </Avatar>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      class="w-(--reka-dropdown-menu-trigger-width) min-w-60 rounded-lg"
      side="right"
      :side-offset="15"
      align="end"
    >
      <DropdownMenuLabel class="p-0 font-normal">
        <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
          <Avatar class="size-8 rounded-lg">
            <AvatarImage :src="user?.avatar ?? ''" :alt="user?.username ?? ''" />
            <AvatarFallback class="rounded-lg"> ZA </AvatarFallback>
          </Avatar>
          <div class="grid flex-1 text-left text-sm leading-tight">
            <span class="truncate font-medium">{{ user?.username }}</span>
            <span class="truncate text-xs text-muted-foreground">
              {{ user?.email }}
            </span>
          </div>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem class="cursor-pointer">
          <Icon name="hugeicons:account-setting-02" size="16" />
          Account
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem class="cursor-pointer">
        <Icon name="hugeicons:logout-02" size="16" />
        Sign out
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
