<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import type { ItemData } from "@/types";

defineProps<{ data: ItemData }>();
const emit = defineEmits<{ select: [text: string] }>();
const { t } = useI18n();
const selected = ref<string | null>(null);

const trueLabel = t("chat.question.trueFalse.true");
const falseLabel = t("chat.question.trueFalse.false");
const trueValue = "正确";
const falseValue = "错误";

function confirm() {
  if (selected.value) {
    emit("select", selected.value);
  }
}
</script>

<template>
  <div>
    <p class="mb-4 text-base font-medium text-gray-800">
      {{ data.question_text }}
    </p>
    <div class="flex flex-col gap-3 sm:flex-row">
      <button
        :class="[
          'flex-1 rounded-lg border px-6 py-4 text-center font-medium transition-all',
          selected === trueValue
            ? 'border-green-500 bg-green-50 text-green-700 ring-2 ring-green-500/20'
            : 'border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:bg-green-50/50',
        ]"
        @click="selected = trueValue"
      >
        <span class="text-2xl">✓</span>
        <span class="ml-2">{{ trueLabel }}</span>
      </button>
      <button
        :class="[
          'flex-1 rounded-lg border px-6 py-4 text-center font-medium transition-all',
          selected === falseValue
            ? 'border-red-500 bg-red-50 text-red-700 ring-2 ring-red-500/20'
            : 'border-gray-200 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50/50',
        ]"
        @click="selected = falseValue"
      >
        <span class="text-2xl">✗</span>
        <span class="ml-2">{{ falseLabel }}</span>
      </button>
    </div>
    <button v-if="selected" class="btn-primary mt-4 w-full" @click="confirm">
      {{ t("chat.question.confirm") }}
    </button>
  </div>
</template>
