<script setup lang="ts">
import type { CommentDocType } from "~/plugins/rxdb.client";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { useRxDbSafe } from "~/composables/use-rxdb";
import { useWorkspaceMembers } from "~/composables/use-workspace-members";

const props = defineProps<{
  workspaceId: string;
  entityType: string;
  entityId: string;
}>();

const { user } = useUserSession();
const workspaceIdRef = computed(() => props.workspaceId);
const { data: workspaceMembers } = useWorkspaceMembers(workspaceIdRef);

const comments = ref<CommentDocType[]>([]);
const newComment = ref("");

const memberMap = computed(() => {
  const map = new Map<string, { username: string; avatar: string | null }>();
  for (const m of workspaceMembers.value ?? []) {
    map.set(m.id, {
      username: m.user?.username ?? m.user?.email ?? "Unknown",
      avatar: m.user?.profilePictureUrl ?? null,
    });
  }
  return map;
});

function resolveAuthor(authorId: string) {
  return memberMap.value.get(authorId) ?? { username: "Unknown", avatar: null };
}

onMounted(async () => {
  const db = await useRxDbSafe();
  if (!db) return;

  const commentSub = db.comments
    .find({
      selector: {
        entity_type: props.entityType,
        entity_id: props.entityId,
        deleted_at: null,
      },
    })
    .$.subscribe((docs) => {
      comments.value = docs;
    });

  onUnmounted(() => {
    commentSub.unsubscribe();
  });
});

const currentMemberId = computed(() => {
  if (!user.value?.id || !workspaceMembers.value) return null;
  return workspaceMembers.value.find((m) => m.userId === user.value!.id)?.id ?? null;
});

async function addComment() {
  const content = newComment.value.trim();
  if (!content) return;
  if (!currentMemberId.value) return;

  const db = await useRxDbSafe();
  if (!db) return;

  await db.comments.insert({
    id: crypto.randomUUID().slice(0, 16),
    entity_type: props.entityType,
    entity_id: props.entityId,
    author_id: currentMemberId.value,
    content,
    parent_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  });

  newComment.value = "";
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="flex items-center gap-2 text-sm font-semibold">
      <Icon name="solar:chat-line-linear" class="size-4" />
      Comments
    </h2>

    <div class="flex items-start gap-3">
      <Avatar class="size-8">
        <AvatarFallback>
          {{ (resolveAuthor(currentMemberId ?? "").username[0] ?? "?").toUpperCase() }}
        </AvatarFallback>
      </Avatar>
      <div class="flex flex-1 flex-col gap-2">
        <Textarea
          v-model="newComment"
          placeholder="Add a comment..."
          class="min-h-20 resize-none"
        />
        <Button
          size="sm"
          class="self-end bg-brand hover:bg-brand-secondary"
          :disabled="!newComment.trim()"
          @click="addComment"
        >
          Comment
        </Button>
      </div>
    </div>

    <div class="mt-4 space-y-4">
      <div v-if="comments.length === 0" class="py-8 text-center text-sm text-muted-foreground">
        No comments yet.
      </div>
      <div v-for="comment in comments" :key="comment.id" class="flex items-start gap-3">
        <Avatar class="size-8">
          <AvatarImage
            :src="resolveAuthor(comment.author_id).avatar ?? undefined"
            :alt="resolveAuthor(comment.author_id).username"
          />
          <AvatarFallback>
            {{ (resolveAuthor(comment.author_id).username[0] ?? "?").toUpperCase() }}
          </AvatarFallback>
        </Avatar>
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline gap-2">
            <span class="text-sm font-semibold">
              {{ resolveAuthor(comment.author_id).username }}
            </span>
            <span class="text-xs text-muted-foreground">
              {{ new Date(comment.created_at).toLocaleString() }}
            </span>
          </div>
          <p class="mt-0.5 text-sm break-words whitespace-pre-wrap">{{ comment.content }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
