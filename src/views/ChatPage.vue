<template>
  <div class="flex h-dvh overflow-hidden">
    <!-- Left sidebar: user profile (desktop only) -->
    <UserProfileSidebar ref="profileSidebar" class="hidden md:flex" />

    <!-- Right: main content -->
    <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <!-- Top bar -->
      <header
        class="flex min-h-14 items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2 sm:px-4 sm:py-3"
      >
        <div class="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            data-testid="mobile-profile-btn"
            class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 md:hidden"
            :aria-label="$t('common.openProfile')"
            @click="mobileProfileOpen = !mobileProfileOpen"
          >
            <svg
              class="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </button>
          <h1 class="truncate text-base font-semibold text-gray-900 sm:text-lg">
            {{ $t("common.appTitle") }}
          </h1>
          <span
            class="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700"
          >
            {{ auth.userId }}
          </span>
        </div>
        <div class="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            data-testid="language-switcher"
            class="rounded-lg px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
            @click="
              localeStore.setLocale(localeStore.locale === 'en' ? 'zh' : 'en')
            "
          >
            {{ localeStore.locale === "en" ? "中文" : "EN" }}
          </button>
          <button
            v-if="sessionStore.sessionId && !sessionStore.sessionResult"
            class="btn-danger px-2.5 py-2 text-xs sm:px-4"
            @click="handleEndSession"
          >
            {{ $t("common.endEvaluation") }}
          </button>
          <button
            class="btn-secondary px-2.5 py-2 text-xs sm:px-4"
            @click="handleLogout"
          >
            {{ $t("common.logout") }}
          </button>
        </div>
      </header>

      <!-- Mobile profile panel: slides down below header, compresses chat area -->
      <div
        data-testid="mobile-profile-panel"
        class="overflow-hidden transition-all duration-300 md:hidden"
        :class="mobileProfileOpen ? 'max-h-80' : 'max-h-0'"
      >
        <div class="bg-gray-900 text-white">
          <div v-if="fetchFailed" class="px-4 py-3 text-xs text-red-300">
            {{ $t("profile.loadFailed") }}
          </div>
          <div class="space-y-2 px-4 py-3">
            <!-- HSK Level -->
            <div class="flex items-center gap-3">
              <div class="text-xl font-bold text-blue-400">
                {{
                  mobileProfile.hsk_level > 1
                    ? "HSK " + mobileProfile.hsk_level
                    : "—"
                }}
              </div>
              <div class="text-xs text-gray-400">
                {{
                  mobileProfile.hsk_level > 1
                    ? $t("profile.currentLevel")
                    : $t("profile.waitingEvaluation")
                }}
              </div>
            </div>

            <!-- Skill bars: 2x2 grid -->
            <div class="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <div v-for="skill in skills" :key="skill.key" class="space-y-0.5">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-gray-400">{{
                    $t(`profile.skills.${skill.key}`)
                  }}</span>
                  <span class="font-mono text-gray-300">{{
                    mobileHasData
                      ? (mobileProfile.skill_levels?.[skill.key] || 0) + "%"
                      : "—"
                  }}</span>
                </div>
                <div class="h-1.5 overflow-hidden rounded-full bg-gray-700">
                  <div
                    v-if="mobileHasData"
                    class="h-full rounded-full transition-all duration-500"
                    :class="skill.color"
                    :style="{
                      width:
                        (mobileProfile.skill_levels?.[skill.key] || 0) + '%',
                    }"
                  />
                  <div
                    v-else
                    class="h-full rounded-full bg-gray-600"
                    style="width: 0%"
                  />
                </div>
              </div>
            </div>

            <!-- Strengths + focus -->
            <div
              v-if="
                mobileProfile.strengths?.length ||
                mobileProfile.next_focus?.length
              "
              class="flex flex-wrap gap-x-4 gap-y-0.5 text-xs"
            >
              <span
                v-if="mobileProfile.strengths?.length"
                class="text-green-300"
                >{{
                  $t("profile.mastered", {
                    items: mobileProfile.strengths.join("、"),
                  })
                }}</span
              >
              <span
                v-if="mobileProfile.next_focus?.length"
                class="text-yellow-300"
                >{{
                  $t("profile.suggestedFocus", {
                    items: mobileProfile.next_focus.join("、"),
                  })
                }}</span
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Main content -->
      <main class="flex-1 overflow-hidden">
        <ChatView
          v-if="!sessionStore.sessionResult"
          @profile-update="onProfileUpdate"
        />
        <SessionReport v-else :result="sessionStore.sessionResult" />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useSessionStore } from "@/stores/session";
import { useRouter } from "vue-router";
import ChatView from "@/components/ChatView.vue";
import SessionReport from "@/components/SessionReport.vue";
import UserProfileSidebar from "@/components/UserProfileSidebar.vue";
import { endSession, getConfidence, getUserProfile } from "@/api";
import { buildSessionResult, createDefaultConfidence } from "@/utils/session";
import type { UserProfileData } from "@/types";

import { useLocaleStore } from "@/stores/locale";

const auth = useAuthStore();
const sessionStore = useSessionStore();
const localeStore = useLocaleStore();
const router = useRouter();
const profileSidebar = ref<InstanceType<typeof UserProfileSidebar> | null>(
  null
);
const mobileProfileOpen = ref(false);

// Mobile profile data (same API as desktop sidebar)
const mobileProfile = ref<UserProfileData>({
  user_id: "",
  hsk_level: 1,
  skill_levels: {
    hsk: 0,
    vocabulary: 0,
    grammar: 0,
    reading: 0,
    listening: 0,
    speaking: 0,
  },
  native_language: null,
  stubborn_errors: [],
  strengths: [],
  next_focus: [],
  updated_at: null,
});

const skills: {
  key: keyof NonNullable<UserProfileData["skill_levels"]>;
  color: string;
}[] = [
  { key: "hsk", color: "bg-blue-500" },
  { key: "vocabulary", color: "bg-purple-500" },
  { key: "grammar", color: "bg-green-500" },
  { key: "reading", color: "bg-orange-500" },
  { key: "listening", color: "bg-pink-500" },
  { key: "speaking", color: "bg-cyan-500" },
];

const mobileHasData = computed(() => {
  const sl = mobileProfile.value.skill_levels;
  return (
    sl &&
    (sl.hsk > 0 ||
      sl.vocabulary > 0 ||
      sl.grammar > 0 ||
      sl.reading > 0 ||
      (sl.listening ?? 0) > 0 ||
      (sl.speaking ?? 0) > 0)
  );
});

const fetchFailed = ref(false);

async function fetchMobileProfile() {
  if (!auth.userId) return;
  try {
    const data = await getUserProfile(auth.userId);
    mobileProfile.value = data as UserProfileData;
    fetchFailed.value = false;
  } catch {
    fetchFailed.value = true;
  }
}

let profileInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  fetchMobileProfile();
  profileInterval = setInterval(fetchMobileProfile, 30000);
});

onUnmounted(() => {
  if (profileInterval) clearInterval(profileInterval);
});

function handleLogout() {
  auth.logout();
  sessionStore.clearSession();
  router.push("/");
}

async function handleEndSession() {
  if (!sessionStore.sessionId) return;
  try {
    const [endResp, confResp] = await Promise.all([
      endSession(sessionStore.sessionId),
      getConfidence(sessionStore.sessionId),
    ]);
    const summary = endResp.summary as Record<string, unknown> | undefined;
    sessionStore.sessionResult = buildSessionResult(summary, confResp);
  } catch {
    sessionStore.sessionResult = buildSessionResult(
      undefined,
      createDefaultConfidence()
    );
  }
}

function onProfileUpdate() {
  profileSidebar.value?.fetchProfile();
  fetchMobileProfile();
}
</script>
