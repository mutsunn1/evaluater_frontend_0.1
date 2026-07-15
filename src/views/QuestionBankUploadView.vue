<template>
  <div class="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
    <div class="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-lg sm:p-8">
      <h1 class="mb-2 text-xl font-bold text-gray-900 sm:text-2xl">
        题库批量导入
      </h1>
      <p class="mb-6 text-sm text-gray-500">
        上传 .jsonl 或 .xlsx 文件，将历史题目导入题库供 RAG 检索使用。
      </p>

      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <input
          ref="fileInput"
          type="file"
          accept=".jsonl,.xlsx"
          class="hidden"
          data-testid="file-input"
          @change="onFileChange"
        />
        <button
          class="btn-secondary w-full px-4 py-2 text-sm sm:w-auto"
          data-testid="select-file-btn"
          @click="fileInput?.click()"
        >
          选择文件
        </button>
        <span
          v-if="selectedFile"
          class="truncate text-sm text-gray-700"
          data-testid="selected-filename"
        >
          {{ selectedFile.name }}
        </span>
        <a
          v-if="token"
          class="ml-auto text-sm text-blue-600 hover:underline"
          data-testid="template-link"
          :href="templateUrl"
          download
        >
          下载模板
        </a>
      </div>

      <button
        class="btn-primary w-full px-4 py-2 text-sm"
        data-testid="upload-btn"
        :disabled="!selectedFile || uploading"
        @click="handleUpload"
      >
        <span v-if="uploading">上传中…</span>
        <span v-else>开始导入</span>
      </button>

      <p
        v-if="errorMsg"
        class="mt-4 text-sm text-red-600"
        data-testid="error-msg"
      >
        {{ errorMsg }}
      </p>

      <div v-if="task" class="mt-8">
        <div class="mb-2 flex items-center justify-between text-sm">
          <span class="font-medium text-gray-700">导入进度</span>
          <span class="text-gray-500" data-testid="progress-text">
            {{ task.processed }} / {{ task.total }}（失败
            {{ task.failed_count }}）
          </span>
        </div>
        <div class="h-2.5 w-full rounded-full bg-gray-200">
          <div
            class="h-2.5 rounded-full bg-blue-600 transition-all duration-300"
            :style="{ width: progressPercent + '%' }"
            data-testid="progress-bar"
          />
        </div>
        <p
          class="mt-2 text-sm font-medium"
          :class="statusColorClass"
          data-testid="status-text"
        >
          {{ statusLabel }}
        </p>

        <div v-if="task.errors.length > 0" class="mt-4">
          <h2 class="mb-2 text-sm font-semibold text-gray-800">失败明细</h2>
          <ul
            class="max-h-60 overflow-auto rounded-lg border border-gray-200 text-sm"
          >
            <li
              v-for="(err, idx) in task.errors"
              :key="idx"
              class="border-b border-gray-100 px-3 py-2 last:border-b-0"
              data-testid="error-row"
            >
              <span class="text-gray-500">行 {{ err.line }}:</span>
              <span class="ml-1 text-red-600">{{ err.reason }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from "vue";
import {
  uploadQuestionBankSamples,
  getQuestionBankUploadTask,
  downloadQuestionBankTemplateUrl,
} from "@/api";

const props = defineProps<{
  token: string;
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const uploading = ref(false);
const errorMsg = ref("");
const task = ref<{
  task_id: string;
  status: string;
  total: number;
  processed: number;
  failed_count: number;
  errors: Array<{ line: number; reason: string }>;
} | null>(null);

let pollTimer: ReturnType<typeof setInterval> | null = null;

const templateUrl = computed(() =>
  downloadQuestionBankTemplateUrl(props.token)
);

const progressPercent = computed(() => {
  if (!task.value || task.value.total === 0) return 0;
  return Math.min(
    100,
    Math.round((task.value.processed / task.value.total) * 100)
  );
});

const statusLabel = computed(() => {
  if (!task.value) return "";
  const map: Record<string, string> = {
    pending: "等待处理",
    running: "处理中…",
    completed: "导入完成",
    failed: "导入失败",
  };
  return map[task.value.status] || task.value.status;
});

const statusColorClass = computed(() => {
  if (!task.value) return "";
  if (task.value.status === "completed") return "text-green-600";
  if (task.value.status === "failed") return "text-red-600";
  return "text-blue-600";
});

async function setSelectedFile(file: File | null) {
  selectedFile.value = file;
  errorMsg.value = "";
}

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  setSelectedFile(target.files?.[0] ?? null);
}

async function handleUpload() {
  if (!selectedFile.value) return;
  uploading.value = true;
  errorMsg.value = "";
  task.value = null;
  stopPolling();

  try {
    const resp = await uploadQuestionBankSamples(
      selectedFile.value,
      props.token
    );
    task.value = {
      task_id: resp.task_id,
      status: resp.status,
      total: 0,
      processed: 0,
      failed_count: 0,
      errors: [],
    };
    startPolling(resp.task_id);
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : "上传失败";
  } finally {
    uploading.value = false;
  }
}

function startPolling(taskId: string) {
  pollTimer = setInterval(async () => {
    try {
      const status = await getQuestionBankUploadTask(taskId, props.token);
      task.value = status;
      if (status.status === "completed" || status.status === "failed") {
        stopPolling();
      }
    } catch (e) {
      errorMsg.value = e instanceof Error ? e.message : "查询任务失败";
      stopPolling();
    }
  }, 1000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

onUnmounted(stopPolling);
</script>
