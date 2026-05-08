import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ChatMessage, ItemData, SessionResult } from '@/types';

export const useSessionStore = defineStore('session', () => {
  const sessionId = ref<string | null>(null);
  const messages = ref<ChatMessage[]>([]);
  const currentQuestions = ref<ItemData[]>([]);  // batch of pending questions
  const currentQuestionIndex = ref(0);
  const isWaitingAnswer = ref(false);
  const isLoading = ref(false);
  const loadingPhase = ref<'generating' | 'judging' | 'cold_start'>('generating');
  const sessionResult = ref<SessionResult | null>(null);
  const error = ref<string | null>(null);
  const isColdStart = ref(false);

  function addMessage(msg: ChatMessage) {
    messages.value.push(msg);
  }

  function clearSession() {
    sessionId.value = null;
    messages.value = [];
    currentQuestions.value = [];
    currentQuestionIndex.value = 0;
    isWaitingAnswer.value = false;
    isLoading.value = false;
    loadingPhase.value = 'generating';
    sessionResult.value = null;
    error.value = null;
    isColdStart.value = false;
  }

  return {
    sessionId,
    messages,
    currentQuestions,
    currentQuestionIndex,
    isWaitingAnswer,
    isLoading,
    loadingPhase,
    sessionResult,
    error,
    isColdStart,
    addMessage,
    clearSession,
  };
});
