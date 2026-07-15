<script setup lang="ts">
import ActionTooltip from '~/components/workspace/shared/action-tooltip.vue'
</script>

<template>
        <ActionTooltip label="Create Workspace">
            <button class='group flex items-center cursor-pointer'>
                <div class='flex mx-3 size-10 rounded-md transition-all overflow-hidden items-center justify-center bg-brand group-hover:bg-brand-secondary/90'>
                    <Icon name="hugeicons:add-01" class='text-white transition' />
                </div>
            </button>
        </ActionTooltip>
</template>
