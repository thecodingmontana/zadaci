<script setup lang="ts">
import WorkspaceInfo from './workspace-info.vue';
</script>

<template>
    <div class="flex flex-col h-full text-primary w-full border-r px-2">
        <WorkspaceInfo />
        <div
            class="py-2 h-full overflow-y-auto [&::-webkit-scrollbar]:w-[0.1rem] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-track]:bg-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500">

            <div class="space-y-2">
                <h3 class="text-xs font-ibm-plex-mono uppercase">Main Menu</h3>
                <div>
                    <div class="flex items-center space-x-2 bg-[#f2f2f2] p-1 rounded cursor-pointer">
                        <Icon name="hugeicons:dashboard-square-03" size="18" />
                    <p>
                        Dashboard
                    </p>
                </div>
                </div>
            </div>
        </div>
    </div>
</template>
