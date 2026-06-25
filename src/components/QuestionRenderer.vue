<template>
  <div>
    <!-- Question meta -->
    <div class="mb-2 flex items-center gap-2 text-xs text-gray-500">
      <span class="rounded bg-blue-50 px-1.5 py-0.5 font-medium">{{
        itemData.scene
      }}</span>
      <span v-if="itemData.grammar_focus">{{ itemData.grammar_focus }}</span>
      <span>{{ itemData.target_level }}</span>
    </div>

    <!-- Dispatch to specific renderer -->
    <MultipleChoice
      v-if="
        itemData.question_type === 'multiple_choice' ||
        itemData.question_type === 'multiple_select' ||
        itemData.question_type === 'listening' ||
        itemData.question_type === 'listening_comprehension'
      "
      :data="itemData"
      @select="emitAnswer"
    />
    <TrueFalse
      v-else-if="itemData.question_type === 'true_false'"
      :data="itemData"
      @select="emitAnswer"
    />
    <FillInBlank
      v-else-if="itemData.question_type === 'fill_in_blank'"
      :data="itemData"
      @submit="emitAnswer"
    />
    <ReadingComprehension
      v-else-if="itemData.question_type === 'reading_comprehension'"
      :data="itemData"
      @submit="emitAnswer"
    />
    <!-- speaking_response: speech placeholder -->
    <template
      v-else-if="
        itemData.question_type === 'speaking_response' ||
        itemData.question_type === 'speaking'
      "
    >
      <MediaPromptBlock
        v-for="m in (itemData.media || []).filter(
          (a: any) =>
            a.role === 'prompt' ||
            a.role === 'question' ||
            a.role === 'stimulus'
        )"
        :key="m.id"
        :asset="m"
      />
      <p class="whitespace-pre-wrap text-base font-medium text-gray-800 mb-3">
        {{ itemData.question_text }}
      </p>
      <SpeechRecorder
        :session-id="sessionId || ''"
        :question-item-id="(itemData as any).question_item_id || 0"
      />
    </template>
    <!-- Fallback: plain text -->
    <p v-else class="text-gray-700">
      {{ itemData.question_text || t("chat.loading") }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { ItemData } from "@/types";
import MultipleChoice from "@/components/MultipleChoice.vue";
import TrueFalse from "@/components/TrueFalse.vue";
import FillInBlank from "@/components/FillInBlank.vue";
import ReadingComprehension from "@/components/ReadingComprehension.vue";
import SpeechRecorder from "@/components/SpeechRecorder.vue";
import MediaPromptBlock from "@/components/MediaPromptBlock.vue";

const { t } = useI18n();
defineProps<{ itemData: ItemData; sessionId?: string }>();
const emit = defineEmits<{ answer: [text: string] }>();

function emitAnswer(text: string) {
  emit("answer", text);
}
</script>
