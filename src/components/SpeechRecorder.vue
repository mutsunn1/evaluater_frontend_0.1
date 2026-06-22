<template>
  <div class="speech-recorder rounded-lg border-2 border-gray-200 p-4">
    <!-- Idle: ready to record -->
    <template v-if="state === 'idle'">
      <p class="text-sm text-gray-600 mb-3 text-center">
        录制你的口头回答（最长60秒）
      </p>
      <div class="text-center">
        <button
          class="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
          data-testid="speech-record-btn"
          @click="startRecording"
        >
          🎙️ 开始录音
        </button>
      </div>
    </template>

    <!-- Recording -->
    <template v-else-if="state === 'recording'">
      <div class="flex items-center justify-between mb-2">
        <span class="inline-flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span class="text-sm font-medium text-red-600">录音中</span>
        </span>
        <span class="text-sm text-gray-500">{{ elapsedDisplay }}</span>
      </div>
      <div class="w-full bg-gray-100 rounded-full h-2 mb-3">
        <div
          class="bg-red-500 h-2 rounded-full transition-all duration-1000"
          :style="{ width: (elapsedSeconds / 60) * 100 + '%' }"
        />
      </div>
      <button
        class="w-full rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
        data-testid="speech-stop-btn"
        @click="stopRecording"
      >
        ⏹ 停止录音
      </button>
    </template>

    <!-- Recorded: can play, delete, or upload -->
    <template v-else-if="state === 'recorded'">
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm font-medium text-gray-700">录音完成</span>
        <span class="text-sm text-gray-500">{{ elapsedDisplay }}</span>
      </div>
      <div class="flex gap-2">
        <button
          v-if="!isPlaying"
          class="flex-1 rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
          data-testid="speech-play-btn"
          @click="playRecording"
        >
          ▶ 试听
        </button>
        <button
          v-else
          class="flex-1 rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white"
          data-testid="speech-pause-btn"
          @click="stopPlayback"
        >
          ⏸ 停止
        </button>
        <button
          class="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          data-testid="speech-delete-btn"
          @click="deleteRecording"
        >
          🗑 重录
        </button>
        <button
          class="rounded-lg bg-green-500 px-3 py-2 text-sm font-medium text-white hover:bg-green-600 transition-colors"
          data-testid="speech-upload-btn"
          @click="uploadRecording"
        >
          上传
        </button>
      </div>
      <audio
        ref="audioRef"
        :src="audioUrl"
        class="hidden"
        @ended="onPlaybackEnded"
      />
    </template>

    <!-- Uploading -->
    <template v-else-if="state === 'uploading'">
      <div class="text-center py-2">
        <span class="text-sm text-gray-500">正在上传并转写...</span>
      </div>
    </template>

    <!-- Transcribed -->
    <template v-else-if="state === 'transcribed'">
      <div class="mb-3 rounded bg-gray-50 p-3">
        <p class="text-xs text-gray-400 mb-1">转写结果（只读核对）</p>
        <p class="text-sm text-gray-800 whitespace-pre-wrap">
          {{ transcript }}
        </p>
      </div>
      <div class="flex gap-2">
        <button
          class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          data-testid="speech-rerecord-btn"
          @click="deleteRecording"
        >
          重录
        </button>
        <button
          class="flex-1 rounded-lg bg-green-500 px-3 py-2 text-sm font-medium text-white hover:bg-green-600 transition-colors"
          data-testid="speech-confirm-btn"
          @click="confirmTranscript"
        >
          确认提交
        </button>
      </div>
    </template>

    <!-- Failed -->
    <template v-else-if="state === 'failed'">
      <p class="text-sm text-red-600 mb-3 text-center">{{ error }}</p>
      <div class="flex gap-2">
        <button
          class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          @click="state = 'recorded'"
        >
          重试上传
        </button>
        <button
          class="flex-1 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          @click="deleteRecording"
        >
          重录
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from "vue";
import { uploadSpeechRecording } from "@/api";

const props = defineProps<{
  sessionId?: string;
  questionItemId?: number;
}>();

const emit = defineEmits<{
  answer: [assetId: string];
}>();

type RecorderState =
  | "idle"
  | "recording"
  | "recorded"
  | "uploading"
  | "transcribed"
  | "failed";

const state = ref<RecorderState>("idle");
const audioUrl = ref<string>("");
const transcript = ref<string>("");
const error = ref<string>("");
const assetId = ref<string>("");
const isPlaying = ref(false);

const elapsedSeconds = ref(0);
let elapsedTimer: ReturnType<typeof setInterval> | null = null;
let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];
const audioRef = ref<HTMLAudioElement | null>(null);

const MAX_SECONDS = 60;

const elapsedDisplay = computed(() => {
  const m = Math.floor(elapsedSeconds.value / 60);
  const s = elapsedSeconds.value % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
});

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm",
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(recordedChunks, { type: mediaRecorder!.mimeType });
      if (audioUrl.value) URL.revokeObjectURL(audioUrl.value);
      audioUrl.value = URL.createObjectURL(blob);
    };

    mediaRecorder.start(100);
    state.value = "recording";
    elapsedSeconds.value = 0;
    elapsedTimer = setInterval(() => {
      elapsedSeconds.value++;
      if (elapsedSeconds.value >= MAX_SECONDS) {
        stopRecording();
      }
    }, 1000);
  } catch (_err) {
    error.value = "无法访问麦克风，请检查浏览器权限设置";
    state.value = "failed";
  }
}

function stopRecording() {
  if (elapsedTimer) {
    clearInterval(elapsedTimer);
    elapsedTimer = null;
  }
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  state.value = "recorded";
}

function playRecording() {
  const audio = audioRef.value;
  if (!audio || !audioUrl.value) return;
  isPlaying.value = true;
  audio.play().catch(() => {
    isPlaying.value = false;
  });
}

function stopPlayback() {
  const audio = audioRef.value;
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
  isPlaying.value = false;
}

function onPlaybackEnded() {
  isPlaying.value = false;
}

function deleteRecording() {
  if (audioUrl.value) URL.revokeObjectURL(audioUrl.value);
  audioUrl.value = "";
  transcript.value = "";
  error.value = "";
  assetId.value = "";
  recordedChunks = [];
  isPlaying.value = false;
  state.value = "idle";
}

async function uploadRecording() {
  if (!audioUrl.value || recordedChunks.length === 0) return;
  state.value = "uploading";
  error.value = "";

  const blob = new Blob(recordedChunks, {
    type: mediaRecorder?.mimeType || "audio/webm",
  });
  const duration = elapsedSeconds.value * 1000;

  try {
    if (!props.sessionId) {
      error.value = "缺少会话ID，无法上传";
      state.value = "failed";
      return;
    }
    const result = await uploadSpeechRecording(
      props.sessionId,
      props.questionItemId || 0,
      blob,
      duration
    );
    assetId.value = result.asset_id;
    if (result.status === "transcribed") {
      transcript.value = result.transcript || "";
      state.value = "transcribed";
    } else {
      error.value = result.error || "转写失败，请重试";
      state.value = "failed";
    }
  } catch (err: any) {
    error.value = err?.message || "上传失败，请检查网络后重试";
    state.value = "failed";
  }
}

function confirmTranscript() {
  if (!assetId.value) return;
  emit("answer", assetId.value);
}

onBeforeUnmount(() => {
  if (elapsedTimer) clearInterval(elapsedTimer);
  if (audioUrl.value) URL.revokeObjectURL(audioUrl.value);
});
</script>
