import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAuthStore = defineStore('auth', () => {
  const userId = ref<string | null>(localStorage.getItem('evaluator_user_id') || null);
  const isLoggedIn = computed(() => userId.value !== null);

  function login(id: string) {
    userId.value = id;
    localStorage.setItem('evaluator_user_id', id);
  }

  function logout() {
    userId.value = null;
    localStorage.removeItem('evaluator_user_id');
  }

  return { userId, isLoggedIn, login, logout };
});
