<script setup lang="ts">
import { Container, Font, Head, Hr, Html, Img, Tailwind, Text } from "@vue-email/components";
import { appLink } from "~~/shared/types/index";

const props = defineProps({
  code: String,
});
</script>

<template>
  <Html lang="en">
    <Head>
      <Font
        font-family="Roboto"
        fallback-font-family="Verdana"
        :web-font="{
          url: 'https://fonts.gstatic.com/s/roboto/v27/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff2',
          format: 'woff2',
        }"
        :font-weight="400"
        font-style="normal"
      />
    </Head>
    <Tailwind
      :config="{
        theme: {
          extend: {
            colors: {
              brand: '#F97452',
            },
            fontFamily: {
              roboto: ['Roboto', 'Verdana'],
            },
          },
        },
        separator: ':',
        safelist: [],
        experimental: {},
        corePlugins: {},
      }"
    >
      <Container class="font-roboto mx-auto max-w-150 px-4 py-8">
        <Link :href="appLink" class="flex items-center justify-center">
          <Img
            src="https://res.cloudinary.com/dfa1yoc1v/image/upload/v1751271040/rrgh50r6tads0nqxnakg.png"
            alt="Zadaci"
            width="200"
            height="60"
            style="margin: 0 auto"
            class="h-16 w-auto rounded-md object-contain"
          />
        </Link>
        <Text class="text-center text-xl font-semibold">
          The code below is only valid for 10 minutes.
        </Text>
        <Text class="text-brand block rounded-md bg-gray-100 p-5 text-center text-3xl">
          {{ props?.code }}
        </Text>

        <Hr class="my-8 border-gray-200" />

        <Container>
          <Text class="mb-2 text-lg font-bold"> What is Zadaci? </Text>
          <Text class="text-base leading-6 text-gray-600">
            Zadaci is an all-in-one project management platform built to help you and your team get
            things done faster.
          </Text>
        </Container>
      </Container>
    </Tailwind>
  </Html>
</template>
