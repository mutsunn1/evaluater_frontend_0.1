import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import LoginView from "./LoginView.vue";
import { useSessionStore } from "@/stores/session";
import { createSession } from "@/api";

const push = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/api", () => ({
  createSession: vi.fn(),
}));

function mountLoginView() {
  setActivePinia(createPinia());
  return mount(LoginView);
}

describe("LoginView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSession).mockReset();
  });

  it("renders the login form in English by default", () => {
    const wrapper = mountLoginView();
    expect(wrapper.text()).toContain("Chinese Proficiency Evaluation System");
    expect(wrapper.text()).toContain("User ID");
    expect(wrapper.text()).toContain("Start Evaluation");
  });

  it("stores the i18n welcome key as a system message after login", async () => {
    createSession.mockResolvedValue({
      session_id: "s-1",
      needs_cold_start: true,
    });

    const wrapper = mountLoginView();
    const input = wrapper.find('input[id="userId"]');
    await input.setValue("test-user");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    const session = useSessionStore();
    expect(session.messages).toHaveLength(1);
    expect(session.messages[0].source).toBe("system");
    expect(session.messages[0].content).toBe("chat.welcome.coldStart");
  });

  it("shows the language switch button", () => {
    const wrapper = mountLoginView();
    const switcher = wrapper.find('[data-testid="language-switcher"]');
    expect(switcher.exists()).toBe(true);
  });

  it("shows parameterized backend error message on failure", async () => {
    createSession.mockRejectedValue(new Error("timeout"));

    const wrapper = mountLoginView();
    const input = wrapper.find('input[id="userId"]');
    await input.setValue("test-user");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("Failed to connect to backend: timeout");
  });
});
