<script setup lang="ts">
import { Home } from "@lucide/vue";
import { computed } from "vue";
import { useRoute } from "vue-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";

const route = useRoute();

const crumbs = computed(() =>
  route.path
    .split("/")
    .filter(Boolean)
    .map((segment, i, arr) => ({
      label: segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " "),
      to: `/${arr.slice(0, i + 1).join("/")}`,
      isLast: i === arr.length - 1,
    })),
);
</script>

<template>
  <Breadcrumb>
    <BreadcrumbList>
      <BreadcrumbItem>
        <BreadcrumbLink as-child>
          <NuxtLink to="/"><Home class="size-3.5" /></NuxtLink>
        </BreadcrumbLink>
      </BreadcrumbItem>

      <template v-for="crumb in crumbs" :key="crumb.to">
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage v-if="crumb.isLast">{{ crumb.label }}</BreadcrumbPage>
          <BreadcrumbLink v-else as-child>
            <NuxtLink :to="crumb.to">{{ crumb.label }}</NuxtLink>
          </BreadcrumbLink>
        </BreadcrumbItem>
      </template>
    </BreadcrumbList>
  </Breadcrumb>
</template>
