<template>
  <img
    v-if="asset.type === 'image'"
    :src="asset.url"
    :alt="asset.alt || ''"
    class="option-media-image h-16 w-16 rounded object-cover"
  />
  <span v-if="asset.type === 'audio'" class="option-media-audio text-lg"
    >🔊</span
  >
</template>

<script setup lang="ts">
import type { MediaAsset } from "@/types";

defineProps<{ asset: MediaAsset }>();
</script>
