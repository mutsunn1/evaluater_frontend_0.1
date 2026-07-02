<template>
  <div v-if="steps.length" class="rounded-2xl border border-gray-200 bg-gray-50/80">
    <!-- 头部：始终可见，点击打开完整弹窗 -->
    <button
      type="button"
      class="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-gray-100/80"
      @click="openModal"
    >
      <svg
        class="h-4 w-4 flex-shrink-0 text-blue-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="12" cy="12" r="3" />
        <path
          d="M12 1v2m0 18v2m11-11h-2M3 12H1m16.36-7.36-1.41 1.41M7.05 16.95l-1.41 1.41m12.72 0-1.41-1.41M7.05 7.05 5.64 5.64"
        />
      </svg>
      <span class="flex-1 truncate text-xs font-medium text-gray-700">
        {{ title }}
      </span>
      <span class="ml-2 text-xs text-gray-400">
        {{ steps.length }} {{ t("chat.thinking.steps") }}
      </span>
      <svg
        class="h-4 w-4 flex-shrink-0 text-gray-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M7 17 17 7M17 7H7M17 7v10" />
      </svg>
    </button>

    <!-- 内联预览：只显示最近两条，自动向上滚动 -->
    <div class="relative overflow-hidden border-t border-gray-200">
      <TransitionGroup
        ref="previewRef"
        tag="div"
        name="thinking-preview"
        class="max-h-[7.5rem] space-y-2 overflow-y-hidden p-3"
      >
        <div
          v-for="(step, i) in previewSteps"
          :key="previewKey(step, i)"
          class="thinking-preview-item rounded-lg border border-gray-100 bg-white p-2.5 shadow-sm"
        >
          <div class="mb-1 flex items-center gap-1.5">
            <span class="text-xs font-semibold text-blue-600">
              {{ displayAgent(step) }}
            </span>
          </div>
          <p class="line-clamp-2 text-xs leading-relaxed text-gray-600">
            {{ step.output }}
          </p>
        </div>
      </TransitionGroup>

      <!-- 底部渐变遮罩，暗示还有更多 -->
      <div
        v-if="steps.length > previewLimit"
        class="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-gray-50/90 to-transparent"
      />
    </div>

    <!-- 完整弹窗 -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-200"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isModalOpen"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          @click.self="closeModal"
        >
          <Transition
            enter-active-class="transition-all duration-300 ease-out"
            enter-from-class="scale-95 opacity-0 translate-y-4"
            enter-to-class="scale-100 opacity-100 translate-y-0"
            leave-active-class="transition-all duration-200 ease-in"
            leave-from-class="scale-100 opacity-100 translate-y-0"
            leave-to-class="scale-95 opacity-0 translate-y-4"
          >
            <div
              v-if="isModalOpen"
              class="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl"
              role="dialog"
              aria-modal="true"
            >
              <!-- 弹窗头部 -->
              <div
                class="flex items-center justify-between border-b border-gray-200 px-4 py-3"
              >
                <div class="flex items-center gap-2">
                  <svg
                    class="h-4 w-4 text-blue-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path
                      d="M12 1v2m0 18v2m11-11h-2M3 12H1m16.36-7.36-1.41 1.41M7.05 16.95l-1.41 1.41m12.72 0-1.41-1.41M7.05 7.05 5.64 5.64"
                    />
                  </svg>
                  <span class="text-sm font-semibold text-gray-800">{{ title }}</span>
                  <span class="text-xs text-gray-400"
                    >{{ steps.length }} {{ t("chat.thinking.steps") }}</span
                  >
                </div>
                <button
                  type="button"
                  class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  @click="closeModal"
                >
                  <svg
                    class="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <!-- 弹窗内容：完整消息链，可滚动 -->
              <div
                ref="modalScrollRef"
                class="flex-1 space-y-3 overflow-y-auto p-4"
              >
                <div
                  v-for="(step, i) in steps"
                  :key="`modal-${i}`"
                  class="rounded-lg border border-gray-100 bg-gray-50 p-3 shadow-sm"
                >
                  <div class="mb-1 flex items-center gap-1.5">
                    <span class="text-xs font-semibold text-blue-600"
                      >{{ displayAgent(step) }}</span
                    >
                  </div>
                  <p
                    class="whitespace-pre-wrap text-sm leading-relaxed text-gray-700"
                  >
                    {{ step.output }}
                  </p>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import type { ThinkingStep } from "@/types";
import { getTranslatedThinkingLabel } from "@/utils/thinking-labels";

const props = defineProps<{
  steps: ThinkingStep[];
  title?: string;
  autoScroll?: boolean;
}>();

const { t } = useI18n();
const previewLimit = 2;
const isModalOpen = ref(false);
const previewRef = ref<HTMLElement | null>(null);
const modalScrollRef = ref<HTMLElement | null>(null);

const title = computed(() => {
  if (props.title) return props.title;
  return t("chat.thinking.title");
});

const previewSteps = computed(() => {
  return props.steps.slice(-previewLimit);
});

function displayAgent(step: ThinkingStep): string {
  return getTranslatedThinkingLabel(step.agent, t);
}

function previewKey(step: ThinkingStep, index: number): string {
  return `${step.agent}-${step.output.slice(0, 40)}-${index}`;
}

function openModal() {
  isModalOpen.value = true;
  document.body.style.overflow = "hidden";
}

function closeModal() {
  isModalOpen.value = false;
  document.body.style.overflow = "";
}

function scrollPreviewToBottom() {
  if (!props.autoScroll) return;
  nextTick(() => {
    const el = previewRef.value;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  });
}

function scrollModalToBottom() {
  nextTick(() => {
    const el = modalScrollRef.value;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  });
}

watch(
  () => props.steps.length,
  () => {
    scrollPreviewToBottom();
    if (isModalOpen.value) {
      scrollModalToBottom();
    }
  },
  { immediate: true }
);

watch(
  () => isModalOpen.value,
  (open) => {
    if (open) scrollModalToBottom();
  }
);
</script>

<style scoped>
.thinking-preview-move,
.thinking-preview-enter-active,
.thinking-preview-leave-active {
  transition: all 0.45s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.thinking-preview-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

.thinking-preview-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

.thinking-preview-leave-active {
  position: absolute;
  width: calc(100% - 1.5rem);
}

.thinking-preview-item {
  backface-visibility: hidden;
}
</style>
