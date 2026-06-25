import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChatPage from "@/views/ChatPage.vue";
import { useAuthStore } from "@/stores/auth";
import { useSessionStore } from "@/stores/session";

// Mock API
vi.mock("@/api", () => ({
  getUserProfile: vi.fn().mockResolvedValue({
    user_id: "test-user",
    hsk_level: 3,
    skill_levels: {
      hsk: 60,
      vocabulary: 55,
      grammar: 45,
      reading: 50,
      speaking: 0,
    },
    native_language: "en",
    stubborn_errors: [],
    strengths: ["词汇量"],
    next_focus: ["语法"],
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
  auth.userId = "test-user";
  auth.isLoggedIn = true;
  const session = useSessionStore();
  session.sessionId = "session-1";

  return mount(ChatPage, {
    global: {
      plugins: [pinia],
      stubs,
    },
  });
}

describe("ChatPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows top bar with title and user id", () => {
    const wrapper = mountChatPage();

    expect(wrapper.text()).toContain("Chinese Proficiency Evaluation");
    expect(wrapper.text()).toContain("test-user");
  });

  it("shows end-evaluation and logout buttons", () => {
    const wrapper = mountChatPage();

    expect(wrapper.text()).toContain("End Evaluation");
    expect(wrapper.text()).toContain("Log Out");
  });

  it("renders language switch button in the header", () => {
    const wrapper = mountChatPage();
    const switcher = wrapper.find('[data-testid="language-switcher"]');
    expect(switcher.exists()).toBe(true);
  });

  describe("mobile profile entry", () => {
    it("renders mobile profile button in the header", () => {
      const wrapper = mountChatPage();

      const btn = wrapper.find('[data-testid="mobile-profile-btn"]');
      expect(btn.exists()).toBe(true);
      expect(btn.attributes("aria-label")).toBe("Open profile");
    });

    it("opens mobile profile panel when hamburger is clicked", async () => {
      const wrapper = mountChatPage();
      await flushPromises();

      const btn = wrapper.find('[data-testid="mobile-profile-btn"]');
      await btn.trigger("click");
      await flushPromises();

      // Panel should be expanded (max-h-80)
      const panel = wrapper.find('[data-testid="mobile-profile-panel"]');
      expect(panel.exists()).toBe(true);
      expect(panel.classes()).toContain("max-h-80");
    });

    it("closes mobile profile panel when hamburger is clicked again", async () => {
      const wrapper = mountChatPage();
      await flushPromises();

      const btn = wrapper.find('[data-testid="mobile-profile-btn"]');

      // Open
      await btn.trigger("click");
      await flushPromises();
      expect(
        wrapper.find('[data-testid="mobile-profile-panel"]').classes()
      ).toContain("max-h-80");

      // Close
      await btn.trigger("click");
      await flushPromises();
      expect(
        wrapper.find('[data-testid="mobile-profile-panel"]').classes()
      ).toContain("max-h-0");
    });

    it("panel starts collapsed", () => {
      const wrapper = mountChatPage();

      const panel = wrapper.find('[data-testid="mobile-profile-panel"]');
      expect(panel.classes()).toContain("max-h-0");
    });

    it("shows profile data in mobile panel when opened", async () => {
      const wrapper = mountChatPage();
      await flushPromises();

      await wrapper.find('[data-testid="mobile-profile-btn"]').trigger("click");
      await flushPromises();

      const panel = wrapper.find('[data-testid="mobile-profile-panel"]');
      expect(panel.text()).toContain("HSK");
      expect(panel.text()).toContain("Overall");
      expect(panel.text()).toContain("Vocabulary");
      expect(panel.text()).toContain("Grammar");
      expect(panel.text()).toContain("Reading");
      expect(panel.text()).toContain("Listening");
      expect(panel.text()).toContain("词汇量");
    });

    it("panel compresses chat area instead of overlaying", async () => {
      const wrapper = mountChatPage();
      await flushPromises();

      // Panel is in normal document flow (between header and main),
      // not a fixed-position overlay. Verify it's not fixed.
      const panel = wrapper.find('[data-testid="mobile-profile-panel"]');
      expect(panel.exists()).toBe(true);
      // Should NOT be position fixed (unlike the old overlay drawer)
      expect(panel.classes()).not.toContain("fixed");
    });
  });
});
