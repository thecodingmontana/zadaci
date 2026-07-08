<script lang="ts" setup>
import { GitCompare } from "@lucide/vue";
import { toast } from "~/lib/toast";
</script>
<template>
  <div>
    <div>
      Hello I know you missed us but currently i am working hard to port this project into something
      new kindly sit back and be patient, my apologies.
    </div>
    <a href="mailto:thecodingmontana@gmail.com">Click to contact me.</a>
    <button
      @click="
        toast.success('Changes saved', {
          desc: 'Atlas redesign · 12 files',
          action: { label: 'View', icon: GitCompare },
        })
      "
    >
      Save
    </button>
  </div>
</template>
