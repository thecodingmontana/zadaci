<script setup lang="ts">
import type { TeammatesWithProfile, WorkspaceInvite } from "~/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import InvitesTable from "../tables/invites/invites-table.vue";
import MembersTable from "../tables/members/members-table.vue";

defineProps<{
  members: TeammatesWithProfile[];
  invites: WorkspaceInvite[];
  membersStatus: "pending" | "idle" | "success" | "error";
  invitesStatus: "pending" | "idle" | "success" | "error";
}>();
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
      <MembersTable :members="members" :status="membersStatus" />
    </TabsContent>
    <TabsContent value="invites">
      <InvitesTable :invites="invites" :status="invitesStatus" />
    </TabsContent>
  </Tabs>
</template>
