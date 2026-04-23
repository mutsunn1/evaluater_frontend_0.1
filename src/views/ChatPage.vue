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

const auth = useAuthStore();
const sessionStore = useSessionStore();
const router = useRouter();
const profileSidebar = ref<InstanceType<typeof UserProfileSidebar> | null>(null);

function handleLogout() {
  auth.logout();
  sessionStore.clearSession();
  router.push('/');
}

function handleEndSession() {
  sessionStore.sessionResult = {
    total_items: 0,
    average_score: 0,
    improved_areas: [],
    regressed_areas: [],
    next_focus: [],
  };
}

function onProfileUpdate() {
  profileSidebar.value?.fetchProfile();
}
</script>
