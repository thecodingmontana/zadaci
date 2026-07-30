<script setup lang="ts">
import Signout from "~/modals/global/signout.vue";
import AddMember from "~/modals/workspace/add-member.vue";
import AddProject from "~/modals/workspace/add-project.vue";
import CreateChannel from "~/modals/workspace/create-channel.vue";
import CreateWorkspace from "~/modals/workspace/create-workspace.vue";
import DeleteChannel from "~/modals/workspace/delete-channel.vue";
import DeleteProject from "~/modals/workspace/delete-project.vue";
import EditChannel from "~/modals/workspace/edit-channel.vue";
</script>

<template>
  <div>
    <Signout />
    <AddMember />
    <CreateChannel />
    <CreateWorkspace />
    <EditChannel />
    <DeleteChannel />
    <DeleteProject />
    <AddProject />
  </div>
</template>
