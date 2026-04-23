<template>
  <div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
    <div class="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-bold text-gray-900">中文水平评测系统</h1>
        <p class="mt-2 text-sm text-gray-500">基于多智能体系统的中文能力评估</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-6">
        <div>
          <label for="userId" class="mb-2 block text-sm font-medium text-gray-700">用户 ID</label>
          <input
            id="userId"
            v-model="inputId"
            type="text"
            placeholder="输入您的用户 ID"
            class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            autocomplete="username"
          />
        </div>

        <button type="submit" class="btn-primary w-full py-3 text-base" :disabled="loading || !inputId.trim()">
          <span v-if="loading">正在登录...</span>
          <span v-else>开始评测</span>
        </button>

        <p v-if="errorMsg" class="text-center text-sm text-red-600">{{ errorMsg }}</p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useSessionStore } from '@/stores/session';
import { createSession } from '@/api';

const router = useRouter();
const auth = useAuthStore();
const sessionStore = useSessionStore();

const inputId = ref('');
const loading = ref(false);
const errorMsg = ref('');

async function handleLogin() {
  const id = inputId.value.trim();
  if (!id) return;

  loading.value = true;
  errorMsg.value = '';

  try {
    auth.login(id);
    sessionStore.clearSession();

    const resp = await createSession(id);

    if ((resp as Record<string, unknown>).needs_cold_start === true) {
      sessionStore.isColdStart = true;
      sessionStore.addMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: '你好！欢迎来到中文水平评测系统。在开始正式评测之前，我需要先了解一些你的背景信息。',
        timestamp: new Date().toISOString(),
      });
    } else {
      sessionStore.addMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: '你好，我是中文水平评测系统。我将根据你的水平进行能力评估，请认真作答。',
        timestamp: new Date().toISOString(),
      });
    }

    // Set sessionId LAST so watch fires with correct state
    sessionStore.sessionId = resp.session_id;

    router.push('/chat');
  } catch (e) {
    errorMsg.value = `连接后端失败：${e instanceof Error ? e.message : '未知错误'}`;
    auth.logout();
  } finally {
    loading.value = false;
  }
}
</script>
