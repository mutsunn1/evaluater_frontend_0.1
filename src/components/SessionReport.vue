<template>
  <div class="mx-auto max-w-2xl p-8">
    <div class="rounded-2xl bg-white p-8 shadow-lg">
      <h2 class="mb-6 text-center text-2xl font-bold text-gray-900">评测报告</h2>
      <p class="mb-6 text-center text-gray-500">本次评测已结束，以下是你的表现总结。</p>

      <div class="space-y-6">
        <!-- Score -->
        <div class="text-center">
          <div class="text-4xl font-bold text-blue-600">{{ result.average_score.toFixed(1) }}</div>
          <div class="text-sm text-gray-500">平均分（满分 100）</div>
        </div>

        <!-- Level change -->
        <div v-if="result.level_change" class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
          <p class="text-sm text-blue-700">
            等级变更:
            <span class="font-bold">{{ result.level_change.from }} → {{ result.level_change.to }}</span>
            <span :class="result.level_change.promoted ? 'text-green-600' : 'text-red-600'">
              {{ result.level_change.promoted ? '🎉 晋升' : '需加强' }}
            </span>
          </p>
        </div>

        <!-- Improvements -->
        <div>
          <h3 class="mb-2 font-semibold text-green-700">进步领域</h3>
          <ul class="space-y-1">
            <li v-for="area in result.improved_areas" :key="area" class="rounded bg-green-50 px-3 py-1.5 text-sm text-green-800">
              {{ area }}
            </li>
            <li v-if="!result.improved_areas.length" class="text-sm text-gray-400">暂无数据</li>
          </ul>
        </div>

        <!-- Regressions -->
        <div>
          <h3 class="mb-2 font-semibold text-red-700">需加强领域</h3>
          <ul class="space-y-1">
            <li v-for="area in result.regressed_areas" :key="area" class="rounded bg-red-50 px-3 py-1.5 text-sm text-red-800">
              {{ area }}
            </li>
            <li v-if="!result.regressed_areas.length" class="text-sm text-gray-400">暂无数据</li>
          </ul>
        </div>

        <!-- Next focus -->
        <div>
          <h3 class="mb-2 font-semibold text-blue-700">建议关注</h3>
          <ul class="space-y-1">
            <li v-for="item in result.next_focus" :key="item" class="rounded bg-blue-50 px-3 py-1.5 text-sm text-blue-800">
              {{ item }}
            </li>
          </ul>
        </div>
      </div>

      <!-- Action -->
      <div class="mt-8 flex gap-3">
        <button class="btn-secondary flex-1" @click="handleBackHome">返回主页</button>
        <button class="btn-primary flex-1" @click="handleNewSession">开始新评测</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useSessionStore } from '@/stores/session';
import type { SessionResult } from '@/types';

defineProps<{ result: SessionResult }>();
const router = useRouter();
const sessionStore = useSessionStore();

function handleBackHome() {
  sessionStore.clearSession();
  router.push('/');
}

function handleNewSession() {
  sessionStore.clearSession();
  router.push('/');
}
</script>
