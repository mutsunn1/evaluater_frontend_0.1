<template>
  <div class="flex h-screen">
    <!-- Left sidebar: user profile -->
    <UserProfileSidebar ref="profileSidebar" />

    <!-- Right: main content -->
    <div class="flex flex-1 flex-col overflow-hidden">
      <!-- Top bar -->
      <header class="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div class="flex items-center gap-3">
          <h1 class="text-lg font-semibold text-gray-900">中文水平评测</h1>
          <span class="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            {{ auth.userId }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <button v-if="sessionStore.sessionId && !sessionStore.sessionResult" class="btn-danger text-xs" @click="handleEndSession">
            结束评测
          </button>
          <button class="btn-secondary text-xs" @click="handleLogout">退出</button>
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
}
</script>
