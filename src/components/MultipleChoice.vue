<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import type { ItemData } from "@/types";

defineProps<{ data: ItemData }>();
const emit = defineEmits<{ select: [text: string] }>();
const { t } = useI18n();
const selected = ref<string | null>(null);

function select(index: string) {
  selected.value = index;
}

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
    <div class="space-y-2">
      <button
        v-for="opt in data.options"
        :key="opt.index"
        :class="[
          'flex w-full items-center rounded-lg border px-4 py-3 text-left transition-all',
          opt.answer_behavior === 'skip_modality' && selected === opt.index
            ? 'border-gray-500 bg-gray-100 text-gray-800 ring-2 ring-gray-400/20'
            : opt.answer_behavior === 'skip_modality'
              ? 'border-dashed border-gray-300 bg-gray-50 text-gray-600 hover:border-gray-400 hover:bg-gray-100'
              : selected === opt.index
                ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20'
                : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/50',
        ]"
        @click="select(opt.index)"
      >
        <span
          class="mr-3 flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold"
          :class="
            opt.answer_behavior === 'skip_modality' && selected === opt.index
              ? 'border-gray-500 bg-gray-500 text-white'
              : opt.answer_behavior === 'skip_modality'
                ? 'border-gray-300 bg-gray-100 text-gray-500'
                : selected === opt.index
                  ? 'border-blue-500 bg-blue-500 text-white'
                  : 'border-gray-300'
          "
        >
          {{ selected === opt.index ? "✓" : opt.index }}
        </span>
        {{ opt.text }}
      </button>
    </div>
    <button v-if="selected" class="btn-primary mt-4 w-full" @click="confirm">
      {{ t("chat.question.confirm") }}
    </button>
  </div>
</template>
