import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChatPage from '@/views/ChatPage.vue';
import { useAuthStore } from '@/stores/auth';
import { useSessionStore } from '@/stores/session';

// Mock API
vi.mock('@/api', () => ({
  getUserProfile: vi.fn().mockResolvedValue({
    user_id: 'test-user',
    hsk_level: 3,
    skill_levels: { hsk: 60, vocabulary: 55, grammar: 45, reading: 50 },
    native_language: 'en',
    stubborn_errors: [],
    strengths: ['词汇量'],
    next_focus: ['语法'],
    updated_at: new Date().toISOString(),
  }),
  endSession: vi.fn(),
  getConfidence: vi.fn(),
}));

// Stub child components
const stubs = {
  ChatView: { template: '<div class="chat-view-stub">ChatView</div>' },
  SessionReport: { template: '<div class="report-stub">Report</div>' },
};

function mountChatPage() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const auth = useAuthStore();
  auth.userId = 'test-user';
  auth.isLoggedIn = true;
  const session = useSessionStore();
  session.sessionId = 'session-1';

  // jsdom defaults to 1024px; innerWidth doesn't affect Tailwind classes.
  // The hamburger button uses md:hidden — md: breakpoint is 768px.
  // Since jsdom viewport is 1024px, md:hidden hides it. We verify the
  // button is in the DOM (just hidden by CSS), which is the correct
  // behavior test — the entry point exists in the template.

  return mount(ChatPage, {
    global: {
      plugins: [pinia],
      stubs,
    },
  });
}

describe('ChatPage mobile profile entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders mobile profile button in the header', () => {
    const wrapper = mountChatPage();

    const btn = wrapper.find('[data-testid="mobile-profile-btn"]');
    expect(btn.exists()).toBe(true);
    expect(btn.attributes('aria-label')).toBe('打开用户资料');
  });

  it('opens mobile profile drawer when hamburger is clicked', async () => {
    const wrapper = mountChatPage();

    const btn = wrapper.find('[data-testid="mobile-profile-btn"]');
    await btn.trigger('click');
    await flushPromises();

    const drawer = wrapper.find('[data-testid="mobile-profile-drawer"]');
    expect(drawer.exists()).toBe(true);
    // Drawer should be visible (translate-x-0) when open
    expect(drawer.classes()).toContain('translate-x-0');
  });

  it('closes mobile profile drawer when backdrop is clicked', async () => {
    const wrapper = mountChatPage();

    // Open first
    await wrapper.find('[data-testid="mobile-profile-btn"]').trigger('click');
    await flushPromises();

    // Click backdrop
    const backdrop = wrapper.find('[data-testid="mobile-profile-backdrop"]');
    expect(backdrop.exists()).toBe(true);
    await backdrop.trigger('click');
    await flushPromises();

    const drawer = wrapper.find('[data-testid="mobile-profile-drawer"]');
    expect(drawer.classes()).toContain('-translate-x-full');
  });

  it('renders profile content inside mobile drawer when opened', async () => {
    const wrapper = mountChatPage();

    await wrapper.find('[data-testid="mobile-profile-btn"]').trigger('click');
    await flushPromises();

    const drawer = wrapper.find('[data-testid="mobile-profile-drawer"]');
    // The drawer contains a UserProfileSidebar which shows profile data
    expect(drawer.find('aside').exists()).toBe(true);
  });

  it('shows top bar with title and user id', () => {
    const wrapper = mountChatPage();

    expect(wrapper.text()).toContain('中文水平评测');
    expect(wrapper.text()).toContain('test-user');
  });

  it('shows end-evaluation and logout buttons', () => {
    const wrapper = mountChatPage();

    expect(wrapper.text()).toContain('结束评测');
    expect(wrapper.text()).toContain('退出');
  });
});
