<script setup lang="ts">
import { Container, Font, Head, Hr, Html, Img, Link, Tailwind, Text } from "@vue-email/components";
import { appLink } from "~~/shared/types/index";

defineProps({
  workspace: String,
  user: String,
  supportLink: String,
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
          },
        },
        separator: ':',
        safelist: [],
        experimental: {},
        corePlugins: {},
      }"
    >
      <Container class="mx-auto max-w-162.5 bg-gray-100 p-5">
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
        <Container>
          <Text class="text-base leading-6 text-gray-600"> Hi there 👋, </Text>
          <Text class="text-base leading-6 text-gray-600">
            You've successfully declined the invite to join
            <strong>{{ workspace }} workspace</strong>.
          </Text>
          <Text class="text-base leading-6 text-gray-600">
            If this was a mistake, please ask the admin to resend the invite.
          </Text>
        </Container>

        <Hr class="mt-8 mb-3 border-gray-200" />

        <Container v-if="supportLink">
          <Text class="text-base leading-6 text-gray-600"> Need help or have questions? </Text>
          <Link :href="supportLink" class="text-brand text-sm"> Contact support </Link>
        </Container>
      </Container>
    </Tailwind>
  </Html>
</template>
