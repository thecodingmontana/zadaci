<script setup lang="ts">
import {ScrollArea} from '~/components/ui/scroll-area'
import {Separator} from '~/components/ui/separator'
import ActionTooltip from '~/components/workspace/shared/action-tooltip.vue'
import NavigationAction from './navigation-action.vue'
</script>

<template>
<aside class='space-y-4 flex flex-col items-center h-full text-primary w-full py-3 border-r'>
    <NavigationAction />

    <Separator class="h-0.5 bg-zinc-300 dark:bg-zinc-700 data-[orientation=horizontal]:w-10" />
    <ScrollArea class="flex-1 w-full">
        <!-- {
            peers.map(peer => (
                <div key={peer.id} class='mb-4'>
                    <NavigationItem id={peer.id} name={peer.name} imageUrl={peer.imageUrl} />
                </div>
            ))
        } -->
    </ScrollArea>
    <div class='pb-3 mt-auto flex items-center flex-col gap-y-2'>
        <ActionTooltip label='Mode' align='center' side='right'>
            <!-- <ModeToggle /> -->M
        </ActionTooltip>
        <ActionTooltip label='Sign out' align='center' side='right'>
            <!-- <SignoutUser /> -->J
        </ActionTooltip>
    </div>
</aside>
</template>
