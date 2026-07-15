import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import type { VueWrapper } from "@vue/test-utils";
import QuestionBankUploadView from "./QuestionBankUploadView.vue";
import {
  uploadQuestionBankSamples,
  getQuestionBankUploadTask,
  downloadQuestionBankTemplateUrl,
} from "@/api";

vi.mock("@/api", () => ({
  uploadQuestionBankSamples: vi.fn(),
  getQuestionBankUploadTask: vi.fn(),
  downloadQuestionBankTemplateUrl: vi.fn(
    (token: string) => `/template?token=${token}`
  ),
}));

async function setSelectedFile(wrapper: VueWrapper, file: File) {
  (
    wrapper.vm as unknown as { setSelectedFile: (file: File | null) => void }
  ).setSelectedFile(file);
  await flushPromises();
}

function mountView(token = "admin-token") {
  setActivePinia(createPinia());
  return mount(QuestionBankUploadView, {
    props: { token },
  });
}

describe("QuestionBankUploadView", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders upload UI and template link", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("题库批量导入");
    const link = wrapper.find('[data-testid="template-link"]');
    expect(link.exists()).toBe(true);
    expect(link.attributes("href")).toBe("/template?token=admin-token");
    expect(downloadQuestionBankTemplateUrl).toHaveBeenCalledWith("admin-token");
  });

  it("selecting a file and clicking upload triggers upload and polls task status", async () => {
    vi.mocked(uploadQuestionBankSamples).mockResolvedValue({
      task_id: "t1",
      status: "pending",
    });
    vi.mocked(getQuestionBankUploadTask)
      .mockResolvedValueOnce({
        task_id: "t1",
        status: "running",
        total: 10,
        processed: 2,
        failed_count: 0,
        errors: [],
      })
      .mockResolvedValueOnce({
        task_id: "t1",
        status: "completed",
        total: 10,
        processed: 10,
        failed_count: 0,
        errors: [],
      });

    const wrapper = mountView();
    const file = new File(["{}"], "samples.jsonl", {
      type: "application/json",
    });
    await setSelectedFile(wrapper, file);

    await wrapper.find('[data-testid="upload-btn"]').trigger("click");
    await flushPromises();

    expect(uploadQuestionBankSamples).toHaveBeenCalledWith(file, "admin-token");

    await vi.advanceTimersByTimeAsync(1000);
    await flushPromises();

    expect(getQuestionBankUploadTask).toHaveBeenCalledWith("t1", "admin-token");
    expect(wrapper.find('[data-testid="status-text"]').text()).toContain(
      "处理中"
    );
    expect(wrapper.find('[data-testid="progress-text"]').text()).toContain(
      "2 / 10"
    );

    await vi.advanceTimersByTimeAsync(1000);
    await flushPromises();

    expect(wrapper.find('[data-testid="status-text"]').text()).toContain(
      "导入完成"
    );
  });

  it("displays upload errors returned by the API", async () => {
    vi.mocked(uploadQuestionBankSamples).mockRejectedValue(
      new Error("network error")
    );

    const wrapper = mountView();
    const file = new File(["{}"], "samples.jsonl", {
      type: "application/json",
    });
    await setSelectedFile(wrapper, file);

    await wrapper.find('[data-testid="upload-btn"]').trigger("click");
    await flushPromises();

    expect(wrapper.find('[data-testid="error-msg"]').text()).toContain(
      "network error"
    );
  });

  it("lists per-row errors when the task finishes with failures", async () => {
    vi.mocked(uploadQuestionBankSamples).mockResolvedValue({
      task_id: "t2",
      status: "pending",
    });
    vi.mocked(getQuestionBankUploadTask).mockResolvedValue({
      task_id: "t2",
      status: "failed",
      total: 2,
      processed: 0,
      failed_count: 2,
      errors: [
        { line: 1, reason: "缺少字段: question_text" },
        { line: 2, reason: "JSON 解析失败" },
      ],
    });

    const wrapper = mountView();
    const file = new File(["{}"], "samples.jsonl", {
      type: "application/json",
    });
    await setSelectedFile(wrapper, file);

    await wrapper.find('[data-testid="upload-btn"]').trigger("click");
    await flushPromises();

    await vi.advanceTimersByTimeAsync(1000);
    await flushPromises();

    const rows = wrapper.findAll('[data-testid="error-row"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain("缺少字段: question_text");
    expect(rows[1].text()).toContain("JSON 解析失败");
  });
});
