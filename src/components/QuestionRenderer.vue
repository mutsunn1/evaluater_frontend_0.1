<template>
  <div>
    <!-- Question meta -->
    <div class="mb-2 flex items-center gap-2 text-xs text-gray-500">
      <span class="rounded bg-blue-50 px-1.5 py-0.5 font-medium">{{ itemData.scene }}</span>
      <span>{{ itemData.grammar_focus }}</span>
      <span>{{ itemData.target_level }}</span>
    </div>

    <!-- Dispatch to specific renderer -->
    <MultipleChoice v-if="itemData.question_type === 'multiple_choice'" :data="itemData" @select="emitAnswer" />
    <TrueFalse v-else-if="itemData.question_type === 'true_false'" :data="itemData" @select="emitAnswer" />
    <FillInBlank v-else-if="itemData.question_type === 'fill_in_blank'" :data="itemData" @submit="emitAnswer" />
    <ReadingComprehension v-else-if="itemData.question_type === 'reading_comprehension'" :data="itemData" @submit="emitAnswer" />
    <!-- Fallback: plain text -->
    <p v-else class="text-gray-700">{{ itemData.question_text || '（题目加载中...）' }}</p>
  </div>
</template>

<script setup lang="ts">
import type { ItemData } from '@/types';
import MultipleChoice from '@/components/MultipleChoice.vue';
import TrueFalse from '@/components/TrueFalse.vue';
import FillInBlank from '@/components/FillInBlank.vue';
import ReadingComprehension from '@/components/ReadingComprehension.vue';

defineProps<{ itemData: ItemData }>();
const emit = defineEmits<{ answer: [text: string] }>();

function emitAnswer(text: string) {
  emit('answer', text);
}
</script>
