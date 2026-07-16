<template>
  <div
    v-if="messages.length"
    class="rounded-2xl border border-green-200 bg-green-50/80"
  >
    <!-- 头部：始终可见，点击打开完整弹窗 -->
    <button
      type="button"
      class="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-green-100/80"
      @click="openModal"
    >
      <svg
        class="h-4 w-4 flex-shrink-0 text-green-600"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
      <span class="flex-1 truncate text-xs font-medium text-green-800"
        >{{ title }}</span
      >
      <span
        v-if="feedbackOutcomes.length"
        class="feedback-outcome-track"
        role="list"
        :aria-label="`${feedbackOutcomes.length} ${t('chat.feedback.items')}`"
      >
        <span
          v-for="(outcome, index) in feedbackOutcomes"
          :key="outcome.id"
          class="feedback-outcome-slot"
          :class="
            outcome.isCorrect
              ? 'feedback-outcome-correct'
              : 'feedback-outcome-incorrect'
          "
          :style="{ animationDelay: `${index * 60}ms` }"
          :title="
            t(
              outcome.isCorrect
                ? 'chat.feedback.correct'
                : 'chat.feedback.incorrect'
            )
          "
          role="listitem"
          data-testid="feedback-outcome-slot"
          :data-correct="String(outcome.isCorrect)"
        >
          <svg
            v-if="outcome.isCorrect"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.9"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="m2.1 6.25 2.25 2.2 5.55-5.4" />
          </svg>
          <svg
            v-else
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="m3.1 3.1 5.8 5.8M8.9 3.1 3.1 8.9" />
          </svg>
        </span>
      </span>
      <span v-else class="ml-2 text-xs text-green-600/80"
        >{{ messages.length }} {{ t("chat.feedback.items") }}</span
      >
      <svg
        class="h-4 w-4 flex-shrink-0 text-green-600/80"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M7 17 17 7M17 7H7M17 7v10" />
      </svg>
    </button>

    <!-- 内联预览：只显示最近两条反馈 -->
    <div class="relative overflow-hidden border-t border-green-200"
    >
      <TransitionGroup
        tag="div"
        name="feedback-preview"
        class="max-h-[7.5rem] space-y-2 overflow-y-hidden p-3"
      >
        <div
          v-for="msg in previewMessages"
          :key="msg.id"
          class="feedback-preview-item rounded-lg border border-green-100 bg-white p-2.5 text-xs text-green-800 shadow-sm"
        >
          <div v-if="msg.thinking_steps?.length" class="mb-2"
          >
            <ThinkingFrame
              :steps="msg.thinking_steps"
              :title="t('chat.thinking.title')"
            />
          </div>
          <p class="line-clamp-2">{{ displayContent(msg) }}</p>
          <div class="mt-1 text-[10px] text-green-600/70"
            >{{ formatTime(msg.timestamp) }}</div
          >
        </div>
      </TransitionGroup>

      <!-- 底部渐变遮罩 -->
      <div
        v-if="messages.length > previewLimit"
        class="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-green-50/90 to-transparent"
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
              class="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-green-200 bg-white shadow-2xl"
              role="dialog"
              aria-modal="true"
            >
              <!-- 弹窗头部 -->
              <div
                class="flex items-center justify-between border-b border-green-200 px-4 py-3"
              >
                <div class="flex items-center gap-2">
                  <svg
                    class="h-4 w-4 text-green-600"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <span class="text-sm font-semibold text-gray-800"
                    >{{ title }}</span
                  >
                  <span class="text-xs text-gray-400"
                    >{{ messages.length }} {{ t("chat.feedback.items") }}</span
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

              <!-- 弹窗内容：完整反馈链 -->
              <div class="flex-1 space-y-3 overflow-y-auto p-4"
              >
                <div
                  v-for="msg in messages"
                  :key="msg.id"
                  class="rounded-lg border border-green-100 bg-green-50 p-3 text-sm text-green-800 shadow-sm"
                >
                  <div v-if="msg.thinking_steps?.length" class="mb-2"
                  >
                    <ThinkingFrame
                      :steps="msg.thinking_steps"
                      :title="t('chat.thinking.title')"
                    />
                  </div>
                  <p class="whitespace-pre-wrap">{{ displayContent(msg) }}</p>
                  <div class="mt-1 text-xs text-green-600/70"
                    >{{ formatTime(msg.timestamp) }}</div
                  >
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
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { ChatMessage } from "@/types";
import ThinkingFrame from "@/components/ThinkingFrame.vue";

const props = defineProps<{
  messages: ChatMessage[];
  title?: string;
}>();

const { t } = useI18n();
const previewLimit = 2;
const isModalOpen = ref(false);

const title = computed(() => {
  if (props.title) return props.title;
  return t("chat.feedback.title", { count: props.messages.length });
});

const previewMessages = computed(() => {
  return props.messages.slice(-previewLimit);
});

const feedbackOutcomes = computed(() => {
  return props.messages.flatMap((message) =>
    typeof message.is_correct === "boolean"
      ? [{ id: message.id, isCorrect: message.is_correct }]
      : []
  );
});

const I18N_KEY_RE = /chat\.(feedback|coldStart)(\.[a-zA-Z0-9_]+)+/g;

function translateEmbeddedKeys(text: string): string {
  return text.replace(I18N_KEY_RE, (key) => {
    try {
      return t(key);
    } catch {
      return key;
    }
  });
}

function displayContent(msg: ChatMessage): string {
  if (msg.source === "system") {
    try {
      return t(msg.content);
    } catch {
      return msg.content;
    }
  }
  if (msg.role === "feedback") {
    return translateEmbeddedKeys(msg.content);
  }
  return msg.content;
}

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function openModal() {
  isModalOpen.value = true;
  document.body.style.overflow = "hidden";
}

function closeModal() {
  isModalOpen.value = false;
  document.body.style.overflow = "";
}

watch(
  () => isModalOpen.value,
  (open) => {
    if (!open) document.body.style.overflow = "";
  }
);
</script>

<style scoped>
.feedback-preview-move,
.feedback-preview-enter-active,
.feedback-preview-leave-active {
  transition: all 0.45s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.feedback-preview-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

.feedback-preview-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

.feedback-preview-leave-active {
  position: absolute;
  width: calc(100% - 1.5rem);
}

.feedback-preview-item {
  backface-visibility: hidden;
}

.feedback-outcome-track {
  display: flex;
  max-width: min(46%, 13rem);
  flex-shrink: 1;
  align-items: center;
  justify-content: flex-end;
  gap: 0.3rem;
  overflow-x: auto;
  padding: 0.1rem 0.05rem;
  scrollbar-width: none;
}

.feedback-outcome-track::-webkit-scrollbar {
  display: none;
}

.feedback-outcome-slot {
  display: inline-flex;
  width: 1.25rem;
  height: 1.25rem;
  flex: 0 0 1.25rem;
  align-items: center;
  justify-content: center;
  border: 1px solid;
  border-radius: 9999px;
  box-shadow:
    inset 0 1px 1px rgb(255 255 255 / 0.75),
    0 1px 2px rgb(20 83 45 / 0.08);
  animation: feedback-outcome-enter 0.34s cubic-bezier(0.2, 0.9, 0.3, 1.25) both;
}

.feedback-outcome-slot svg {
  width: 0.72rem;
  height: 0.72rem;
}

.feedback-outcome-correct {
  border-color: #86efac;
  background: #dcfce7;
  color: #15803d;
}

.feedback-outcome-incorrect {
  border-color: #fda4af;
  background: #fff1f2;
  color: #e11d48;
}

@keyframes feedback-outcome-enter {
  from {
    opacity: 0;
    transform: translateX(5px) scale(0.55);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .feedback-outcome-slot {
    animation: none;
  }
}
</style>
