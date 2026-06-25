<template>
  <div class="mx-auto max-w-2xl p-8">
    <div class="rounded-2xl bg-white p-8 shadow-lg">
      <h2 class="mb-6 text-center text-2xl font-bold text-gray-900">
        {{ $t("report.title") }}
      </h2>
      <p class="mb-6 text-center text-gray-500">{{ $t("report.subtitle") }}</p>

      <div class="space-y-6">
        <!-- Score -->
        <div class="flex items-center justify-center gap-8">
          <div class="text-center">
            <div class="text-4xl font-bold text-blue-600">
              {{ result.average_score.toFixed(1) }}
            </div>
            <div class="text-sm text-gray-500">
              {{ $t("report.averageScore") }}
            </div>
          </div>
          <div class="text-center">
            <div class="text-4xl font-bold text-green-600">
              {{ result.total_items }}
            </div>
            <div class="text-sm text-gray-500">
              {{ $t("report.totalItems") }}
            </div>
          </div>
          <div v-if="result.hsk_adjustment" class="text-center">
            <div
              class="text-lg font-bold"
              :class="
                result.hsk_adjustment === '建议提升'
                  ? 'text-emerald-600'
                  : result.hsk_adjustment === '需加强'
                    ? 'text-amber-600'
                    : 'text-gray-600'
              "
            >
              {{ result.hsk_adjustment }}
            </div>
            <div class="text-sm text-gray-500">
              {{ $t("report.hskSuggestion") }}
            </div>
          </div>
        </div>

        <!-- AI Summary (markdown rendered) -->
        <div
          v-if="result.summary"
          class="rounded-lg border border-gray-200 bg-gray-50 p-4"
        >
          <h3 class="mb-2 font-semibold text-gray-700">
            {{ $t("report.summary") }}
          </h3>
          <div
            class="prose prose-sm max-w-none text-sm leading-relaxed text-gray-700"
            v-html="renderMarkdown(result.summary)"
          ></div>
        </div>

        <!-- Notable sentences -->
        <div
          v-if="result.notable_sentences?.length"
          class="rounded-lg border border-amber-200 bg-amber-50 p-4"
        >
          <h3 class="mb-2 font-semibold text-amber-700">
            {{ $t("report.notableSentences") }}
          </h3>
          <ul class="space-y-1">
            <li
              v-for="(sentence, idx) in result.notable_sentences"
              :key="idx"
              class="rounded bg-amber-100 px-3 py-1.5 text-sm italic text-amber-900"
            >
              "{{ sentence }}"
            </li>
          </ul>
        </div>

        <!-- Interest areas (mapped to improved_areas) -->
        <div
          v-if="result.interest_areas?.length || result.improved_areas.length"
        >
          <h3 class="mb-2 font-semibold text-green-700">
            {{ $t("report.interestAreas") }}
          </h3>
          <ul class="space-y-1">
            <li
              v-for="area in result.interest_areas?.length
                ? result.interest_areas
                : result.improved_areas"
              :key="area"
              class="rounded bg-green-50 px-3 py-1.5 text-sm text-green-800"
            >
              {{ area }}
            </li>
          </ul>
        </div>

        <!-- Stubborn errors (mapped to regressed_areas) -->
        <div
          v-if="result.stubborn_errors?.length || result.regressed_areas.length"
        >
          <h3 class="mb-2 font-semibold text-red-700">
            {{ $t("report.stubbornErrors") }}
          </h3>
          <ul class="space-y-1">
            <li
              v-for="area in result.stubborn_errors?.length
                ? result.stubborn_errors
                : result.regressed_areas"
              :key="area"
              class="rounded bg-red-50 px-3 py-1.5 text-sm text-red-800"
            >
              {{ area }}
            </li>
          </ul>
        </div>

        <!-- Next focus -->
        <div>
          <h3 class="mb-2 font-semibold text-blue-700">
            {{ $t("report.nextFocus") }}
          </h3>
          <ul class="space-y-1">
            <li
              v-for="item in result.next_focus"
              :key="item"
              class="rounded bg-blue-50 px-3 py-1.5 text-sm text-blue-800"
            >
              {{ item }}
            </li>
            <li v-if="!result.next_focus.length" class="text-sm text-gray-400">
              {{ $t("report.noData") }}
            </li>
          </ul>
        </div>
      </div>

      <!-- Action -->
      <div class="mt-8 flex gap-3">
        <button class="btn-secondary flex-1" @click="handleBackHome">
          {{ $t("report.backHome") }}
        </button>
        <button class="btn-primary flex-1" @click="handleNewSession">
          {{ $t("report.newSession") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useSessionStore } from "@/stores/session";
import { createSession } from "@/api";
import type { SessionResult } from "@/types";
import { marked } from "marked";
import { createClientId } from "@/utils/id";

defineProps<{ result: SessionResult }>();
const router = useRouter();
const sessionStore = useSessionStore();
const auth = useAuthStore();

function handleBackHome() {
  sessionStore.clearSession();
  router.push("/");
}

async function handleNewSession() {
  if (!auth.userId) return;
  sessionStore.clearSession();

  try {
    const resp = await createSession(auth.userId);
    if ((resp as Record<string, unknown>).needs_cold_start === true) {
      sessionStore.isColdStart = true;
      sessionStore.addMessage({
        id: createClientId(),
        role: "system",
        source: "system",
        content: "chat.welcome.coldStart",
        timestamp: new Date().toISOString(),
      });
    } else {
      sessionStore.addMessage({
        id: createClientId(),
        role: "system",
        source: "system",
        content: "chat.welcome.assessment",
        timestamp: new Date().toISOString(),
      });
    }
    sessionStore.sessionId = resp.session_id;
    router.push("/chat");
  } catch {
    // If session creation fails, fall back to home
    router.push("/");
  }
}

function renderMarkdown(text: string): string {
  return marked.parse(text) as string;
}
</script>
