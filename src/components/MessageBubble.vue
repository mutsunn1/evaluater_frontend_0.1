<template>
  <div :class="['flex', alignment]">
    <div :class="containerClass">
      <ThinkingFrame
        v-if="showThinkingAbove"
        :steps="message.thinking_steps || []"
        :title="t('chat.thinking.title')"
        class="mb-2"
      />

      <!-- Main bubble -->
      <div :class="['rounded-2xl px-3 py-3 text-sm sm:px-4', bubbleClass]">
        <!-- Role badge -->
        <div
          v-if="roleLabel"
          class="mb-1 text-xs font-semibold"
          :class="badgeClass"
        >
          {{ roleLabel }}
        </div>

        <!-- Batch questions rendering -->
        <template
          v-if="message.batch_questions && message.batch_questions.length"
        >
          <div
            v-for="(q, qi) in message.batch_questions"
            :key="qi"
            class="mb-4 last:mb-0"
          >
            <!-- Question meta: scene, grammar_focus, target_level -->
            <div
              class="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500"
            >
              <span class="rounded bg-blue-50 px-1.5 py-0.5 font-medium">{{
                q.scene
              }}</span>
              <span v-if="q.grammar_focus">{{ q.grammar_focus }}</span>
              <span>{{ q.target_level }}</span>
            </div>
            <!-- Media prompt blocks -->
            <template v-if="q.media && q.media.length">
              <MediaPromptBlock
                v-for="m in q.media.filter(
                  (a: any) =>
                    a.role === 'prompt' ||
                    a.role === 'question' ||
                    a.role === 'stimulus'
                )"
                :key="m.id"
                :asset="m"
              />
            </template>
            <!-- Response mode placeholders (speech/handwriting/upload) -->
            <template v-if="resolveResponseMode(q) === 'speech'">
              <p
                v-if="q.question_text"
                class="whitespace-pre-wrap text-base font-medium text-gray-800 mb-3"
              >
                {{ q.question_text }}
              </p>
              <SpeechRecorder
                :session-id="props.message.session_id || ''"
                :question-item-id="(q.question_item_id as number) || 0"
                @answer="
                  (assetId: string) => {
                    speechAssets[qi] = assetId;
                    batchAnswers[qi] = assetId;
                  }
                "
              />
              <button
                v-for="opt in (q.options || []).filter(isSkipOption)"
                :key="opt.index"
                :class="skipOptionButtonClass(qi, opt)"
                @click="batchAnswers[qi] = opt.index"
              >
                {{ opt.text }}
              </button>
            </template>
            <HandwritingResponsePlaceholder
              v-else-if="resolveResponseMode(q) === 'handwriting'"
            />
            <UploadResponsePlaceholder
              v-else-if="resolveResponseMode(q) === 'upload'"
            />
            <!-- Standard text answer (fill_in_blank etc) -->
            <div
              v-else-if="resolveResponseMode(q) === 'text'"
              class="space-y-3"
            >
              <p
                class="whitespace-pre-wrap text-base font-medium text-gray-800"
              >
                {{ q.question_text }}
              </p>
              <div v-if="q.blank_count && q.blank_count > 0" class="space-y-2">
                <label v-for="n in q.blank_count" :key="n" class="block">
                  <span class="mb-1 block text-xs text-gray-500">{{
                    t("chat.question.blankLabel", { n })
                  }}</span>
                  <input
                    v-model="batchFillAnswers[qi]"
                    type="text"
                    class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    :placeholder="t('chat.question.fillBlank')"
                  />
                </label>
              </div>
              <input
                v-else
                v-model="batchFillAnswers[qi]"
                type="text"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                :placeholder="t('chat.question.fillBlank')"
              />
            </div>
            <!-- Choice dispatch -->
            <template v-else-if="resolveResponseMode(q) === 'choice'">
              <!-- Single choice -->
              <div
                v-if="
                  isSingleChoiceQuestion(q) && q.options && q.options.length > 0
                "
                class="space-y-2"
              >
                <p class="mb-2 text-base font-medium text-gray-800">
                  {{ q.question_text }}
                </p>
                <button
                  v-for="opt in q.options"
                  :key="opt.index"
                  :class="optionButtonClass(qi, opt)"
                  @click="batchAnswers[qi] = opt.index"
                >
                  <span
                    class="mr-3 flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold"
                    :class="optionMarkerClass(qi, opt)"
                  >
                    {{ batchAnswers[qi] === opt.index ? "✓" : opt.index }}
                  </span>
                  <MediaOptionAsset
                    v-if="opt.media_id && findMediaById(q.media, opt.media_id)"
                    :asset="findMediaById(q.media, opt.media_id)!"
                  />
                  <span v-if="opt.text || !opt.media_id">{{ opt.text }}</span>
                  <span v-else>{{ opt.index }}. media</span>
                </button>
              </div>
              <!-- Multiple choice (multiple select) -->
              <div
                v-else-if="
                  q.question_type === 'multiple_select' &&
                  q.options &&
                  q.options.length > 0
                "
                class="space-y-2"
              >
                <p class="mb-2 text-base font-medium text-gray-800">
                  {{ q.question_text }}
                </p>
                <p class="mb-2 text-xs text-orange-600">
                  {{ t("chat.question.multiSelectHint") }}
                </p>
                <button
                  v-for="opt in q.options"
                  :key="opt.index"
                  :class="optionButtonClass(qi, opt, true)"
                  @click="toggleMultiSelect(qi, opt.index)"
                >
                  <span
                    class="mr-3 flex h-6 w-6 items-center justify-center rounded border-2 text-xs font-bold"
                    :class="optionMarkerClass(qi, opt, true)"
                  >
                    {{
                      (selectedMulti[qi] || []).includes(opt.index)
                        ? "✓"
                        : opt.index
                    }}
                  </span>
                  <MediaOptionAsset
                    v-if="opt.media_id && findMediaById(q.media, opt.media_id)"
                    :asset="findMediaById(q.media, opt.media_id)!"
                  />
                  <span v-if="opt.text || !opt.media_id">{{ opt.text }}</span>
                  <span v-else>{{ opt.index }}. media</span>
                </button>
              </div>
              <!-- Fallback: choice without options → text input -->
              <div
                v-else-if="
                  q.question_type === 'multiple_choice' ||
                  q.question_type === 'multiple_select'
                "
                class="space-y-2"
              >
                <p
                  class="mb-2 whitespace-pre-wrap text-base font-medium text-gray-800"
                >
                  {{ q.question_text }}
                </p>
                <input
                  v-model="batchFillAnswers[qi]"
                  type="text"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  :placeholder="t('chat.placeholder.answer')"
                />
              </div>
              <div
                v-else-if="q.question_type === 'true_false'"
                class="flex flex-col gap-3 sm:flex-row"
              >
                <p class="mb-2 w-full text-base font-medium text-gray-800">
                  {{ q.question_text }}
                </p>
                <button
                  :class="[
                    'flex-1 rounded-lg border px-6 py-4 text-center font-medium transition-all',
                    batchAnswers[qi] === trueOption
                      ? 'border-green-500 bg-green-50 text-green-700 ring-2 ring-green-500/20'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:bg-green-50/50',
                  ]"
                  @click="batchAnswers[qi] = trueOption"
                >
                  <span class="text-2xl">✓</span>
                  <span class="ml-2">{{ trueOption }}</span>
                </button>
                <button
                  :class="[
                    'flex-1 rounded-lg border px-6 py-4 text-center font-medium transition-all',
                    batchAnswers[qi] === falseOption
                      ? 'border-red-500 bg-red-50 text-red-700 ring-2 ring-red-500/20'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50/50',
                  ]"
                  @click="batchAnswers[qi] = falseOption"
                >
                  <span class="text-2xl">✗</span>
                  <span class="ml-2">{{ falseOption }}</span>
                </button>
              </div>
              <div v-else class="space-y-3">
                <p
                  class="whitespace-pre-wrap text-base font-medium text-gray-800"
                >
                  {{ q.question_text }}
                </p>
                <div
                  v-if="q.blank_count && q.blank_count > 0"
                  class="space-y-2"
                >
                  <label v-for="n in q.blank_count" :key="n" class="block">
                    <span class="mb-1 block text-xs text-gray-500">{{
                      t("chat.question.blankLabel", { n })
                    }}</span>
                    <input
                      v-model="batchFillAnswers[qi]"
                      type="text"
                      class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      :placeholder="t('chat.question.fillBlank')"
                    />
                  </label>
                </div>
                <input
                  v-else
                  v-model="batchFillAnswers[qi]"
                  type="text"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  :placeholder="t('chat.question.fillBlank')"
                />
              </div>
            </template>
            <!-- end choice dispatch -->
          </div>

          <!-- Unified submit button for batch -->
          <button
            v-if="canBatchSubmit"
            class="btn-primary mt-4 w-full"
            @click="submitBatch"
          >
            {{ t("chat.question.submitAll") }}
          </button>
          <div v-else class="mt-2 text-center text-xs text-gray-400">
            {{ t("chat.question.completeAll") }}
          </div>
        </template>

        <!-- Single question rendering (also cold start structured items) -->
        <QuestionRenderer
          v-else-if="
            (message.role === 'question' || message.role === 'cold_start') &&
            message.item_data
          "
          :item-data="message.item_data"
          @answer="onAnswer"
        />

        <!-- Plain text content -->
        <p v-else-if="message.content" class="whitespace-pre-wrap">
          {{ displayContent }}
        </p>

        <!-- Timestamp -->
        <div class="mt-1 text-xs" :class="timeClass">
          {{ formatTime(message.timestamp) }}
        </div>
      </div>

      <!-- Thinking steps (below question/feedback bubbles) -->
      <ThinkingFrame
        v-if="showThinkingBelow"
        :steps="message.thinking_steps || []"
        :title="t('chat.thinking.title')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type {
  ChatMessage,
  MediaAsset,
  BatchAnswerPayload,
  ItemData,
  QuestionOption,
} from "@/types";
import { resolveResponseMode } from "@/utils/question";
import QuestionRenderer from "@/components/QuestionRenderer.vue";
import ThinkingFrame from "@/components/ThinkingFrame.vue";
import MediaPromptBlock from "@/components/MediaPromptBlock.vue";
import MediaOptionAsset from "@/components/MediaOptionAsset.vue";
import SpeechRecorder from "@/components/SpeechRecorder.vue";
import HandwritingResponsePlaceholder from "@/components/HandwritingResponsePlaceholder.vue";
import UploadResponsePlaceholder from "@/components/UploadResponsePlaceholder.vue";

const props = defineProps<{ message: ChatMessage }>();
const { t } = useI18n();
const emit = defineEmits<{
  answer: [text: string];
  batchSubmit: [answers: BatchAnswerPayload[]];
}>();

const alignment = computed(() =>
  props.message.role === "user" ? "justify-end" : "justify-start"
);

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

const displayContent = computed(() => {
  if (props.message.source === "system") {
    return t(props.message.content);
  }
  if (
    props.message.role === "cold_start" &&
    props.message.cold_start_data?.questionKey
  ) {
    return t(props.message.cold_start_data.questionKey);
  }
  if (props.message.role === "feedback") {
    return translateEmbeddedKeys(props.message.content);
  }
  return props.message.content;
});

const containerClass = computed(() =>
  props.message.role === "user"
    ? "max-w-[78%] sm:max-w-[80%]"
    : "w-full max-w-full sm:max-w-[80%]"
);

const hasThinking = computed(() =>
  Boolean(
    props.message.thinking_steps && props.message.thinking_steps.length > 0
  )
);

const showThinkingAbove = computed(
  () => hasThinking.value && props.message.role === "question"
);

const showThinkingBelow = computed(
  () => hasThinking.value && !showThinkingAbove.value
);

const bubbleClass = computed(() => {
  switch (props.message.role) {
    case "user":
      return "bg-blue-600 text-white";
    case "system":
      return "bg-gray-100 text-gray-800";
    case "question":
      return "bg-white border border-gray-200 text-gray-800";
    case "feedback":
      return "bg-green-50 text-green-800 border border-green-200";
    case "cold_start":
      return "bg-indigo-50 text-indigo-800 border border-indigo-200";
    default:
      return "bg-gray-100 text-gray-800";
  }
});

const roleLabel = computed(() => {
  switch (props.message.role) {
    case "system":
      return t("chat.roles.system");
    case "question":
      return props.message.batch_questions?.length
        ? t("chat.roles.batchQuestion", {
            count: props.message.batch_questions.length,
          })
        : t("chat.roles.question");
    case "feedback":
      return t("chat.roles.feedback");
    case "cold_start":
      return props.message.cold_start_data?.labelKey
        ? t(props.message.cold_start_data.labelKey)
        : t("chat.roles.coldStart", {
            round: props.message.cold_start_data?.round || "",
          });
    default:
      return "";
  }
});

const trueOption = t("chat.question.trueFalse.true");
const falseOption = t("chat.question.trueFalse.false");

const badgeClass = computed(() => {
  switch (props.message.role) {
    case "system":
      return "text-gray-500";
    case "question":
      return "text-blue-600";
    case "feedback":
      return "text-green-600";
    case "cold_start":
      return "text-indigo-600";
    default:
      return "";
  }
});

const timeClass = computed(() =>
  props.message.role === "user" ? "text-blue-200 text-right" : "text-gray-400"
);

function isPlaceholderMode(mode: string): boolean {
  return mode === "speech" || mode === "handwriting" || mode === "upload";
}

function isSkipOption(opt: QuestionOption): boolean {
  return opt.answer_behavior === "skip_modality";
}

function getSkipOption(
  q: Pick<ItemData, "options">
): QuestionOption | undefined {
  return q.options?.find(isSkipOption);
}

function isSingleChoiceQuestion(q: ItemData): boolean {
  return (
    q.question_type === "multiple_choice" ||
    q.question_type === "listening" ||
    q.question_type === "listening_comprehension" ||
    (resolveResponseMode(q) === "choice" &&
      q.question_type !== "multiple_select" &&
      q.question_type !== "true_false")
  );
}

function isOptionSelected(
  qi: number,
  opt: QuestionOption,
  multi = false
): boolean {
  return multi
    ? (selectedMulti.value[qi] || []).includes(opt.index)
    : batchAnswers.value[qi] === opt.index;
}

function optionButtonClass(
  qi: number,
  opt: QuestionOption,
  multi = false
): string[] {
  const selected = isOptionSelected(qi, opt, multi);
  const base =
    "flex min-h-12 w-full items-center rounded-lg border px-3 py-3 text-left transition-all sm:px-4";
  if (isSkipOption(opt)) {
    return [
      base,
      selected
        ? "border-gray-500 bg-gray-100 text-gray-800 ring-2 ring-gray-400/20"
        : "border-dashed border-gray-300 bg-gray-50 text-gray-600 hover:border-gray-400 hover:bg-gray-100",
    ];
  }
  return [
    base,
    selected
      ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20"
      : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/50",
  ];
}

function optionMarkerClass(
  qi: number,
  opt: QuestionOption,
  multi = false
): string {
  const selected = isOptionSelected(qi, opt, multi);
  if (isSkipOption(opt)) {
    return selected
      ? "border-gray-500 bg-gray-500 text-white"
      : "border-gray-300 bg-gray-100 text-gray-500";
  }
  return selected
    ? "border-blue-500 bg-blue-500 text-white"
    : "border-gray-300";
}

function skipOptionButtonClass(qi: number, opt: QuestionOption): string[] {
  return optionButtonClass(qi, opt);
}

// Batch answer state
const batchAnswers = ref<Record<number, string>>({});
const batchFillAnswers = ref<Record<number, string>>({});
const selectedMulti = ref<Record<number, string[]>>({});
const speechAssets = ref<Record<number, string>>({});

// Reset answers when message changes
watch(
  () => props.message.id,
  () => {
    batchAnswers.value = {};
    batchFillAnswers.value = {};
    selectedMulti.value = {};
  },
  { immediate: true }
);

function toggleMultiSelect(qi: number, index: string) {
  const selected = selectedMulti.value[qi] || [];
  const idx = selected.indexOf(index);
  if (idx >= 0) {
    selectedMulti.value[qi] = selected.filter((i) => i !== index);
  } else {
    selectedMulti.value[qi] = [...selected, index];
  }
}

const canBatchSubmit = computed(() => {
  const questions = props.message.batch_questions || [];
  return questions.every((q, qi) => {
    const mode = resolveResponseMode(q);
    // speech/handwriting/upload 模式的题目不需要用户交互即可提交
    if (isPlaceholderMode(mode)) {
      return !getSkipOption(q) || !!batchAnswers.value[qi];
    }
    return (
      !!batchAnswers.value[qi] ||
      (selectedMulti.value[qi] && selectedMulti.value[qi].length > 0) ||
      !!batchFillAnswers.value[qi]?.trim()
    );
  });
});

function findMediaById(
  mediaList: MediaAsset[] | undefined,
  mediaId: string
): MediaAsset | undefined {
  return mediaList?.find((m) => m.id === mediaId);
}

function submitBatch() {
  const questions = props.message.batch_questions || [];
  const answers = questions.map((q, qi) => {
    const base: Record<string, unknown> = { question_index: qi };
    const mode = resolveResponseMode(q);
    if (isPlaceholderMode(mode)) {
      base.response_mode = mode;
      // Speech answers upload an audio asset; the backend resolves the
      // transcript from response_asset_ids (NOT from `answer`). Stashing the
      // asset_id in `answer` left it invisible to the grader, so every speech
      // response was treated as empty. Handwriting/upload keep their value in
      // `answer` as before.
      //
      // Skip-option (answer_behavior=skip_modality) still travels in `answer`
      // because the backend grader detects the skip via answer text. When a
      // speech asset was uploaded we prefer that; otherwise we keep whatever
      // batchAnswers holds (the skip index or empty).
      if (mode === "speech" && speechAssets.value[qi]) {
        base.response_asset_ids = [speechAssets.value[qi]];
        base.answer = "";
      } else {
        base.response_asset_ids = [];
        base.answer = batchAnswers.value[qi] ?? "";
      }
    } else if (isSingleChoiceQuestion(q) || q.question_type === "true_false") {
      base.answer = batchAnswers.value[qi] ?? "";
    } else if (q.question_type === "multiple_select") {
      base.answer = (selectedMulti.value[qi] || []).join(", ");
    } else {
      base.answer = batchFillAnswers.value[qi]?.trim() || "";
    }
    return base;
  });
  emit("batchSubmit", answers as unknown as BatchAnswerPayload[]);
}

function onAnswer(text: string) {
  emit("answer", text);
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
</script>
