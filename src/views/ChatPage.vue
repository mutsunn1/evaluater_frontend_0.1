<template>
  <div class="flex h-dvh overflow-hidden">
    <!-- Left sidebar: user profile -->
    <UserProfileSidebar ref="profileSidebar" class="hidden md:flex" />

    <div v-if="mobileProfileOpen" data-testid="mobile-profile-backdrop" class="fixed inset-0 z-40 bg-black/30 md:hidden" @click="mobileProfileOpen = false" />
    <div
      data-testid="mobile-profile-drawer"
      :class="[
        'fixed left-0 top-0 z-50 h-dvh transform transition-transform duration-300 md:hidden',
        mobileProfileOpen ? 'translate-x-0' : '-translate-x-full',
      ]"
    >
      <UserProfileSidebar ref="mobileProfileSidebar" />
    </div>

    <!-- Right: main content -->
    <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <!-- Top bar -->
      <header class="flex min-h-14 items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2 sm:px-4 sm:py-3">
        <div class="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            data-testid="mobile-profile-btn"
            class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 md:hidden"
            aria-label="打开用户资料"
            @click="mobileProfileOpen = true"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </button>
          <h1 class="truncate text-base font-semibold text-gray-900 sm:text-lg">中文水平评测</h1>
          <span class="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            {{ auth.userId }}
          </span>
        </div>
        <div class="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button v-if="sessionStore.sessionId && !sessionStore.sessionResult" class="btn-danger px-2.5 py-2 text-xs sm:px-4" @click="handleEndSession">
            结束评测
          </button>
          <button class="btn-secondary px-2.5 py-2 text-xs sm:px-4" @click="handleLogout">退出</button>
        </div>
      </header>

      <!-- Main content -->
      <main class="flex-1 overflow-hidden">
        <ChatView v-if="!sessionStore.sessionResult" @profile-update="onProfileUpdate" />
        <SessionReport v-else :result="sessionStore.sessionResult" />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useSessionStore } from '@/stores/session';
import { useRouter } from 'vue-router';
import ChatView from '@/components/ChatView.vue';
import SessionReport from '@/components/SessionReport.vue';
import UserProfileSidebar from '@/components/UserProfileSidebar.vue';
import { endSession, getConfidence } from '@/api';
import { buildSessionResult, createDefaultConfidence } from '@/utils/session';

const auth = useAuthStore();
const sessionStore = useSessionStore();
const router = useRouter();
const profileSidebar = ref<InstanceType<typeof UserProfileSidebar> | null>(null);
const mobileProfileSidebar = ref<InstanceType<typeof UserProfileSidebar> | null>(null);
const mobileProfileOpen = ref(false);

function handleLogout() {
  auth.logout();
  sessionStore.clearSession();
  router.push('/');
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
    sessionStore.sessionResult = buildSessionResult(undefined, createDefaultConfidence());
  }
}

function onProfileUpdate() {
  profileSidebar.value?.fetchProfile();
  mobileProfileSidebar.value?.fetchProfile();
}
</script>
