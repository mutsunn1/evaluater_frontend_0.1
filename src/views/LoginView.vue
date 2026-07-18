<template>
  <div
    class="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4"
  >
    <div class="absolute right-4 top-4">
      <button
        data-testid="language-switcher"
        class="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50"
        @click="
          localeStore.setLocale(localeStore.locale === 'en' ? 'zh' : 'en')
        "
      >
        {{ localeStore.locale === "en" ? "中文" : "EN" }}
      </button>
    </div>

    <div class="w-[min(90vw,22rem)] rounded-2xl bg-white p-6 shadow-lg sm:p-8">
      <div class="mb-6 text-center">
        <h1 class="text-lg font-bold leading-snug text-gray-900 sm:text-xl">
          {{ $t("common.appTitleFull") }}
        </h1>
        <p class="mt-1.5 text-xs text-gray-500 sm:text-sm">
          {{ $t("common.appSubtitle") }}
        </p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label
            for="userId"
            class="mb-1.5 block text-xs font-medium text-gray-700 sm:text-sm"
            >{{ $t("common.userId") }}</label
          >
          <input
            id="userId"
            v-model="inputId"
            type="text"
            :placeholder="$t('common.userIdPlaceholder')"
            class="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:py-2.5"
            autocomplete="username"
          />
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-gray-700 sm:text-sm">{{
              $t("common.includeListening")
            }}</span>
            <button
              type="button"
              role="switch"
              :aria-checked="includeListening"
              data-testid="toggle-listening"
              class="relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              :class="includeListening ? 'bg-blue-600' : 'bg-gray-200'"
              @click="toggleListening"
            >
              <span
                class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                :class="includeListening ? 'translate-x-5' : ''"
              />
            </button>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-gray-700 sm:text-sm">{{
              $t("common.includeSpeaking")
            }}</span>
            <button
              type="button"
              role="switch"
              :aria-checked="includeSpeaking"
              data-testid="toggle-speaking"
              class="relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              :class="includeSpeaking ? 'bg-blue-600' : 'bg-gray-200'"
              @click="toggleSpeaking"
            >
              <span
                class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                :class="includeSpeaking ? 'translate-x-5' : ''"
              />
            </button>
          </div>
        </div>

        <button
          type="submit"
          class="btn-primary w-full py-2 text-base sm:py-2.5"
          :disabled="loading || !inputId.trim()"
        >
          <span v-if="loading">{{ $t("common.loggingIn") }}</span>
          <span v-else>{{ $t("common.startEvaluation") }}</span>
        </button>

        <p v-if="errorMsg" class="text-center text-sm text-red-600">
          {{ errorMsg }}
        </p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "@/stores/auth";
import { useSessionStore } from "@/stores/session";
import { useLocaleStore } from "@/stores/locale";
import { createSession } from "@/api";
import { createClientId } from "@/utils/id";

const router = useRouter();
const { t } = useI18n();
const auth = useAuthStore();
const sessionStore = useSessionStore();
const localeStore = useLocaleStore();

const inputId = ref("");
const loading = ref(false);
const errorMsg = ref("");

// Session content preferences, persisted across visits (default: on).
const LISTENING_STORAGE_KEY = "evaluater-include-listening";
const SPEAKING_STORAGE_KEY = "evaluater-include-speaking";

function readBoolPreference(key: string): boolean {
  try {
    const stored = localStorage.getItem(key);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {
    // localStorage unavailable (e.g. private mode): fall back to default
  }
  return true;
}

function writeBoolPreference(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? "true" : "false");
  } catch {
    // Persistence is best-effort; ignore storage failures
  }
}

const includeListening = ref(readBoolPreference(LISTENING_STORAGE_KEY));
const includeSpeaking = ref(readBoolPreference(SPEAKING_STORAGE_KEY));

function toggleListening() {
  includeListening.value = !includeListening.value;
  writeBoolPreference(LISTENING_STORAGE_KEY, includeListening.value);
}

function toggleSpeaking() {
  includeSpeaking.value = !includeSpeaking.value;
  writeBoolPreference(SPEAKING_STORAGE_KEY, includeSpeaking.value);
}

async function handleLogin() {
  const id = inputId.value.trim();
  if (!id) return;

  loading.value = true;
  errorMsg.value = "";

  try {
    auth.login(id);
    sessionStore.clearSession();

    const resp = await createSession(id, {
      includeListening: includeListening.value,
      includeSpeaking: includeSpeaking.value,
    });

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

    // Set sessionId LAST so watch fires with correct state
    sessionStore.sessionId = resp.session_id;

    router.push("/chat");
  } catch (e) {
    errorMsg.value = t("common.error.backend", {
      message: e instanceof Error ? e.message : "Unknown error",
    });
    auth.logout();
  } finally {
    loading.value = false;
  }
}
</script>
