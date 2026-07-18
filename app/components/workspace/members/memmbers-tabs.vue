<script setup lang="ts">
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import MembersTable from "../tables/members/members-table.vue";
</script>

<template>
  <Tabs default-value="teammates" class="w-full">
    <TabsList class="w-fit rounded-none bg-transparent p-0">
      <TabsTrigger
        value="teammates"
        class="cursor-pointer rounded-none py-2.5 text-base data-[state=active]:border-t-0 data-[state=active]:border-b-2 data-[state=active]:border-l-0 data-[state=active]:border-b-brand data-[state=active]:font-semibold data-[state=active]:text-brand data-[state=active]:shadow-none data-[state=active]:ring-0 data-[state=active]:ring-offset-0 data-[state=active]:outline-none data-[state=inactive]:text-muted-foreground data-[state=inactive]:ring-0 data-[state=inactive]:outline-none dark:data-[state=active]:border-r-0 data-[state=active]:dark:border-b-primary dark:data-[state=active]:bg-transparent data-[state=active]:dark:text-brand"
      >
        Members
      </TabsTrigger>
      <TabsTrigger
        value="invites"
        class="cursor-pointer rounded-none py-2.5 text-base data-[state=active]:border-t-0 data-[state=active]:border-b-2 data-[state=active]:border-l-0 data-[state=active]:border-b-brand data-[state=active]:font-semibold data-[state=active]:text-brand data-[state=active]:shadow-none data-[state=active]:ring-0 data-[state=active]:ring-offset-0 data-[state=active]:outline-none data-[state=inactive]:text-muted-foreground data-[state=inactive]:ring-0 data-[state=inactive]:outline-none dark:data-[state=active]:border-r-0 data-[state=active]:dark:border-b-primary dark:data-[state=active]:bg-transparent data-[state=active]:dark:text-brand"
      >
        Invites
      </TabsTrigger>
    </TabsList>
    <TabsContent value="teammates">
      <MembersTable />
    </TabsContent>
    <TabsContent value="invites"> Invites Table </TabsContent>
  </Tabs>
</template>
