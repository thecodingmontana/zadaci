<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Separator } from "~/components/ui/separator";
</script>

<template>
    <div class="py-3 flex items-center gap-x-2">
        <Avatar class="size-10 rounded-md">
            <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
            <AvatarFallback class="rounded-md">CN</AvatarFallback>
        </Avatar>
        <div>
            <h2 class="text-primary font-semibold">
                Acme Sounds
            </h2>
            <div class="flex h-5 items-center space-x-4 text-xs font-ibm-plex-mono">
                <div>Members: 23</div>
                <Separator orientation="vertical" />
                <div>Online: 0</div>
            </div>
        </div>
    </div>
</template>
