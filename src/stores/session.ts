import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ChatMessage, ItemData, SessionResult } from '@/types';

export const useSessionStore = defineStore('session', () => {
  const sessionId = ref<string | null>(null);
  const messages = ref<ChatMessage[]>([]);
  const currentQuestion = ref<ItemData | null>(null);
  const isWaitingAnswer = ref(false);
  const isLoading = ref(false);
  const sessionResult = ref<SessionResult | null>(null);
  const error = ref<string | null>(null);
  const isColdStart = ref(false);

  function addMessage(msg: ChatMessage) {
    messages.value.push(msg);
  }

  function clearSession() {
    sessionId.value = null;
    messages.value = [];
    currentQuestion.value = null;
    isWaitingAnswer.value = false;
    isLoading.value = false;
    sessionResult.value = null;
    error.value = null;
    isColdStart.value = false;
  }

  return {
    sessionId,
    messages,
    currentQuestion,
    isWaitingAnswer,
    isLoading,
    sessionResult,
    error,
    isColdStart,
    addMessage,
    clearSession,
  };
});
