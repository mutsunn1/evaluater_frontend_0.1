<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { ConfidenceStats } from "@/types";
defineProps<{ stats: ConfidenceStats }>();
const { t } = useI18n();
</script>

<template>
  <div
    v-if="stats.total_rounds > 0 || stats.sample_size > 0"
    class="border-t border-gray-200 bg-white px-4 py-2"
  >
    <div class="mx-auto max-w-2xl space-y-2">
      <!-- Round progress -->
      <div class="flex items-center justify-between text-xs text-gray-500">
        <span class="font-medium">{{ t("chat.confidence.progress") }}</span>
        <span class="font-semibold">{{
          t("chat.confidence.round", {
            current: stats.total_rounds,
            max: stats.max_rounds,
          })
        }}</span>
      </div>
      <div class="h-2 overflow-hidden rounded-full bg-gray-200">
        <div
          class="h-full rounded-full transition-all"
          :class="
            stats.total_rounds >= stats.max_rounds
              ? 'bg-blue-500'
              : stats.total_rounds >= stats.min_rounds
                ? 'bg-green-500'
                : 'bg-yellow-400'
          "
          :style="{
            width:
              Math.min(100, (stats.total_rounds / stats.max_rounds) * 100) +
              '%',
          }"
        />
      </div>

      <!-- Per-dimension coverage -->
      <div
        class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 sm:gap-x-4"
      >
        <div class="flex items-center gap-1">
          <span class="w-2 h-2 rounded-full bg-purple-500" />
          <span
            >{{ t("profile.skills.vocabulary") }}
            {{ stats.dimension_rounds?.vocabulary || 0
            }}{{ t("chat.question.roundUnit") }}</span
          >
        </div>
        <div class="flex items-center gap-1">
          <span class="w-2 h-2 rounded-full bg-green-500" />
          <span
            >{{ t("profile.skills.grammar") }}
            {{ stats.dimension_rounds?.grammar || 0
            }}{{ t("chat.question.roundUnit") }}</span
          >
        </div>
        <div class="flex items-center gap-1">
          <span class="w-2 h-2 rounded-full bg-orange-500" />
          <span
            >{{ t("profile.skills.reading") }}
            {{ stats.dimension_rounds?.reading || 0
            }}{{ t("chat.question.roundUnit") }}</span
          >
        </div>
        <div class="flex items-center gap-1">
          <span class="w-2 h-2 rounded-full bg-pink-500" />
          <span
            >{{ t("profile.skills.listening") }}
            {{ stats.dimension_rounds?.listening || 0
            }}{{ t("chat.question.roundUnit") }}</span
          >
        </div>
        <div class="flex items-center gap-1">
          <span class="w-2 h-2 rounded-full bg-cyan-500" />
          <span
            >{{ t("profile.skills.speaking") }}
            {{ stats.dimension_rounds?.speaking || 0
            }}{{ t("chat.question.roundUnit") }}</span
          >
        </div>
        <div class="sm:ml-auto">
          <span
            >{{ t("chat.confidence.accuracy") }} {{ stats.accuracy }}% ·
            {{ t("chat.confidence.confidence") }}
            {{ (stats.confidence * 100).toFixed(0) }}%</span
          >
        </div>
      </div>

      <!-- Stop indicator -->
      <div v-if="stats.should_stop" class="text-center">
        <span
          class="inline-flex animate-pulse rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700"
        >
          ✓ {{ t("chat.confidence.complete") }}
        </span>
      </div>
    </div>
  </div>
</template>
