<template>
  <aside
    :class="[
      'flex flex-col bg-gray-900 text-white transition-all duration-300',
      expanded ? 'w-64' : 'w-12',
    ]"
  >
    <!-- Toggle button -->
    <button
      class="flex h-12 items-center justify-center border-b border-gray-700 hover:bg-gray-800"
      @click="expanded = !expanded"
    >
      <svg
        v-if="!expanded"
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
      <svg
        v-else
        class="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    </button>

    <!-- Expanded content -->
    <div v-if="expanded" class="flex-1 overflow-y-auto p-4 space-y-6">
      <div
        v-if="fetchFailed"
        class="rounded-lg border border-red-400/30 bg-red-900/20 px-3 py-2 text-xs text-red-300"
      >
        {{ $t("profile.loadFailed") }}
      </div>
      <!-- HSK Level -->
      <div class="text-center">
        <div class="text-3xl font-bold text-blue-400">
          {{ profile.hsk_level > 1 ? "HSK " + profile.hsk_level : "—" }}
        </div>
        <div class="text-xs text-gray-400">
          {{
            profile.hsk_level > 1
              ? $t("profile.currentLevel")
              : $t("profile.waitingEvaluation")
          }}
        </div>
      </div>

      <!-- Skill Bars -->
      <div class="space-y-3">
        <h4
          class="text-xs font-semibold uppercase tracking-wider text-gray-500"
        >
          {{ $t("profile.skills.hsk") }}
        </h4>
        <div v-for="skill in skills" :key="skill.key" class="space-y-1">
          <div class="flex items-center justify-between text-xs">
            <span>{{ $t(`profile.skills.${skill.key}`) }}</span>
            <span class="font-mono">{{
              hasData
                ? (profile.skill_levels?.[skill.key] || 0) + "%"
                : $t("profile.unknown")
            }}</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-gray-700">
            <div
              v-if="hasData"
              class="h-full rounded-full transition-all duration-500"
              :class="skill.color"
              :style="{ width: (profile.skill_levels?.[skill.key] || 0) + '%' }"
            />
            <div
              v-else
              class="h-full rounded-full bg-gray-600 animate-pulse"
              style="width: 0%"
            />
          </div>
        </div>
      </div>

      <!-- Strengths -->
      <div v-if="profile.strengths?.length" class="space-y-2">
        <h4
          class="text-xs font-semibold uppercase tracking-wider text-gray-500"
        >
          {{ $t("profile.mastered", { items: "" }) }}
        </h4>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="s in profile.strengths"
            :key="s"
            class="rounded-full bg-green-900/50 px-2 py-0.5 text-xs text-green-300"
          >
            {{ s }}
          </span>
        </div>
      </div>

      <!-- Focus areas -->
      <div v-if="profile.next_focus?.length" class="space-y-2">
        <h4
          class="text-xs font-semibold uppercase tracking-wider text-gray-500"
        >
          {{ $t("profile.suggestedFocus", { items: "" }) }}
        </h4>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="f in profile.next_focus"
            :key="f"
            class="rounded-full bg-yellow-900/50 px-2 py-0.5 text-xs text-yellow-300"
          >
            {{ f }}
          </span>
        </div>
      </div>

      <!-- Last updated -->
      <div v-if="profile.updated_at" class="text-xs text-gray-600">
        {{ $t("profile.updatedAt", { time: formatTime(profile.updated_at) }) }}
      </div>
    </div>

    <!-- Collapsed icon dots -->
    <div v-else class="flex-1 flex items-center justify-center">
      <div class="flex flex-col items-center gap-3">
        <div class="w-2 h-2 rounded-full bg-blue-400" />
        <div class="w-2 h-2 rounded-full bg-green-400" />
        <div class="w-2 h-2 rounded-full bg-yellow-400" />
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useAuthStore } from "@/stores/auth";
import { getUserProfile } from "@/api";
import type { UserProfileData } from "@/types";

const auth = useAuthStore();
const expanded = ref(true);
const profile = ref<UserProfileData>({
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

// Has any data been collected?
const hasData = computed(() => {
  const sl = profile.value.skill_levels;
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

async function fetchProfile() {
  if (!auth.userId) return;
  try {
    const data = await getUserProfile(auth.userId);
    profile.value = data as UserProfileData;
    fetchFailed.value = false;
  } catch (e) {
    console.error("Failed to load user profile:", e);
    fetchFailed.value = true;
  }
}

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleString("zh-CN");
  } catch {
    return "";
  }
}

let profileInterval: ReturnType<typeof setInterval> | null = null;

// Initial fetch
fetchProfile();

// Refresh every 30 seconds, cleaned up on unmount
onMounted(() => {
  profileInterval = setInterval(fetchProfile, 30000);
});

onUnmounted(() => {
  if (profileInterval) {
    clearInterval(profileInterval);
  }
});

// Expose for manual refresh
defineExpose({ fetchProfile });
</script>
