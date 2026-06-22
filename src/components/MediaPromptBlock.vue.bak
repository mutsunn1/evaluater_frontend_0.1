<template>
  <div class="media-prompt mb-3">
    <img
      v-if="asset.type === 'image'"
      :src="asset.url"
      :alt="asset.alt || ''"
      class="max-w-full rounded-lg"
    />
    <audio
      v-else-if="asset.type === 'audio'"
      :src="asset.url"
      controls
      class="w-full"
    />
    <video
      v-else-if="asset.type === 'video'"
      :src="asset.url"
      controls
      class="w-full rounded-lg"
    />
    <span v-if="asset.alt" class="mt-1 block text-xs text-gray-500">{{
      asset.alt
    }}</span>
  </div>
</template>

<script setup lang="ts">
import type { MediaAsset } from "@/types";

defineProps<{ asset: MediaAsset }>();
</script>
