import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import LoginView from "./LoginView.vue";
import { useSessionStore } from "@/stores/session";
import { createSession } from "@/api";
import { i18n } from "@/i18n";

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

describe("LoginView 听力/口语题开关", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSession).mockReset();
  });

  it("默认渲染两个开关且均为开启状态", () => {
    const wrapper = mountLoginView();

    const listening = wrapper.find('[data-testid="toggle-listening"]');
    const speaking = wrapper.find('[data-testid="toggle-speaking"]');
    expect(listening.exists()).toBe(true);
    expect(speaking.exists()).toBe(true);
    expect(listening.attributes("aria-checked")).toBe("true");
    expect(speaking.attributes("aria-checked")).toBe("true");
    expect(wrapper.text()).toContain("Include listening questions");
    expect(wrapper.text()).toContain("Include speaking questions");
  });

  it("登录时将开关选择作为参数传给 createSession", async () => {
    createSession.mockResolvedValue({
      session_id: "s-1",
      needs_cold_start: false,
    });

    const wrapper = mountLoginView();
    await wrapper.find('[data-testid="toggle-listening"]').trigger("click");
    await wrapper.find('input[id="userId"]').setValue("test-user");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(createSession).toHaveBeenCalledWith("test-user", {
      includeListening: false,
      includeSpeaking: true,
    });
  });

  it("开关选择持久化到 localStorage，重新进入时恢复", async () => {
    const wrapper = mountLoginView();
    await wrapper.find('[data-testid="toggle-speaking"]').trigger("click");

    expect(localStorage.getItem("evaluater-include-speaking")).toBe("false");
    expect(localStorage.getItem("evaluater-include-listening")).toBeNull();

    const remounted = mountLoginView();
    expect(
      remounted
        .find('[data-testid="toggle-speaking"]')
        .attributes("aria-checked")
    ).toBe("false");
    expect(
      remounted
        .find('[data-testid="toggle-listening"]')
        .attributes("aria-checked")
    ).toBe("true");
  });

  it("中文界面显示中文开关文案", async () => {
    const wrapper = mountLoginView();
    // Set locale after mount: the locale store re-syncs i18n from
    // localStorage when first instantiated.
    i18n.global.locale.value = "zh";
    await flushPromises();

    expect(wrapper.text()).toContain("包含听力题");
    expect(wrapper.text()).toContain("包含口语题");
  });
});
