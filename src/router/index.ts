import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'login', component: () => import('@/views/LoginView.vue') },
    { path: '/chat', name: 'chat', component: () => import('@/views/ChatPage.vue'), meta: { requiresAuth: true } },
  ],
});

router.beforeEach((to) => {
  if (to.meta.requiresAuth) {
    const auth = useAuthStore();
    if (!auth.isLoggedIn) return { name: 'login' };
  }
  return true;
});

export default router;
