<script setup lang="ts">
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { dummyMembers } from "~/lib/dummy-data/channel";

const emit = defineEmits<{ close: [] }>();

const linkedThreads = [
  { name: "Campaigns", count: 8 },
  { name: "Content Calendar", count: 5 },
  { name: "Analytics & Reports", count: 3 },
];
</script>

<template>
  <div class="flex h-full w-[300px] flex-col border-l">
    <div class="flex items-center justify-between border-b px-4 py-3">
      <div>
        <p class="text-sm font-semibold"># General</p>
        <p class="text-xs text-muted-foreground">Marketing Team</p>
      </div>
      <Button variant="ghost" size="icon-xs" aria-label="Close panel" @click="emit('close')">
        <Icon name="lucide:x" size="16" />
      </Button>
    </div>

    <Tabs default-value="info" class="flex min-h-0 flex-1 flex-col">
      <TabsList class="mx-4 mt-3">
        <TabsTrigger value="info" class="flex-1">Info</TabsTrigger>
        <TabsTrigger value="files" class="flex-1">Files</TabsTrigger>
        <TabsTrigger value="links" class="flex-1">Links</TabsTrigger>
      </TabsList>

      <TabsContent value="info" class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <p class="mb-2 text-xs font-medium text-muted-foreground">Channel Info</p>
        <dl class="space-y-3 text-sm">
          <div class="flex items-center justify-between">
            <dt class="flex items-center gap-2 text-muted-foreground">
              <Icon name="lucide:user" size="14" /> Created by
            </dt>
            <dd class="flex items-center gap-1.5 font-medium">
              <Avatar class="h-5 w-5">
                <AvatarImage :src="dummyMembers[0].avatar" />
              </Avatar>
              {{ dummyMembers[0].name }}
            </dd>
          </div>
          <div class="flex items-center justify-between">
            <dt class="flex items-center gap-2 text-muted-foreground">
              <Icon name="lucide:calendar" size="14" /> Date created
            </dt>
            <dd class="font-medium">May 10, 2024</dd>
          </div>
          <div>
            <dt class="mb-1 flex items-center gap-2 text-muted-foreground">
              <Icon name="lucide:info" size="14" /> Description
            </dt>
            <dd class="text-sm">
              General discuss for the Marketing Team. Share updates & questions, and collaborate
              with the team.
            </dd>
          </div>
          <div class="flex items-center justify-between">
            <dt class="flex items-center gap-2 text-muted-foreground">
              <Icon name="lucide:circle" size="14" /> Status
            </dt>
            <dd>
              <Badge variant="secondary" class="text-green-600">• Active</Badge>
            </dd>
          </div>
          <div class="flex items-center justify-between">
            <dt class="flex items-center gap-2 text-muted-foreground">
              <Icon name="lucide:eye" size="14" /> Type
            </dt>
            <dd class="font-medium">Public Channel</dd>
          </div>
        </dl>

        <Separator class="my-4" />

        <p class="mb-2 text-xs font-medium text-muted-foreground">Linked Threads</p>
        <div class="space-y-2">
          <div
            v-for="thread in linkedThreads"
            :key="thread.name"
            class="flex items-center justify-between text-sm"
          >
            <span class="flex items-center gap-1.5 text-primary"># {{ thread.name }}</span>
            <span class="text-muted-foreground">{{ thread.count }}</span>
          </div>
        </div>
        <button type="button" class="mt-2 text-xs font-medium text-primary">
          Show all threads &gt;
        </button>

        <Separator class="my-4" />

        <div class="flex items-center justify-between">
          <p class="text-xs font-medium text-muted-foreground">Members</p>
          <Button variant="ghost" size="icon-xs" aria-label="Add member">
            <Icon name="lucide:plus" size="14" />
          </Button>
        </div>
        <div class="mt-2 space-y-3">
          <div
            v-for="member in dummyMembers.filter((m) => m.id !== 'me')"
            :key="member.id"
            class="flex items-center gap-2"
          >
            <Avatar class="h-8 w-8">
              <AvatarImage :src="member.avatar" />
              <AvatarFallback>{{ member.name[0] }}</AvatarFallback>
            </Avatar>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ member.name }}</p>
              <p class="truncate text-xs text-muted-foreground">{{ member.email }}</p>
            </div>
            <Badge v-if="member.role === 'admin'" variant="secondary" class="gap-1 text-xs">
              <Icon name="lucide:star" size="10" /> Admin
            </Badge>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="files" class="flex-1 px-4 py-3 text-sm text-muted-foreground">
        No files shared yet.
      </TabsContent>
      <TabsContent value="links" class="flex-1 px-4 py-3 text-sm text-muted-foreground">
        No links shared yet.
      </TabsContent>
    </Tabs>
  </div>
</template>
