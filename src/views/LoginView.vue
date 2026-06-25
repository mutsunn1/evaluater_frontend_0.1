<template>
  <div
    class="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100"
  >
    <div class="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
      <div class="mb-8 text-center">
        <div class="flex items-center justify-center gap-2">
          <h1 class="text-2xl font-bold text-gray-900">
            {{ $t("common.appTitleFull") }}
          </h1>
          <button
            data-testid="language-switcher"
            class="rounded-lg px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
            @click="
              localeStore.setLocale(localeStore.locale === 'en' ? 'zh' : 'en')
            "
          >
            {{ localeStore.locale === "en" ? "中文" : "EN" }}
          </button>
        </div>
        <p class="mt-2 text-sm text-gray-500">{{ $t("common.appSubtitle") }}</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-6">
        <div>
          <label
            for="userId"
            class="mb-2 block text-sm font-medium text-gray-700"
            >{{ $t("common.userId") }}</label
          >
          <input
            id="userId"
            v-model="inputId"
            type="text"
            :placeholder="$t('common.userIdPlaceholder')"
            class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            autocomplete="username"
          />
        </div>

        <button
          type="submit"
          class="btn-primary w-full py-3 text-base"
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

async function handleLogin() {
  const id = inputId.value.trim();
  if (!id) return;

  loading.value = true;
  errorMsg.value = "";

  try {
    auth.login(id);
    sessionStore.clearSession();

    const resp = await createSession(id);

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
