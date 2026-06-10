import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import MediaPromptBlock from "./MediaPromptBlock.vue";
import type { MediaAsset } from "@/types";

const imageAsset: MediaAsset = {
  id: "img1",
  type: "image",
  role: "prompt",
  source: "prepared",
  url: "/media/test.png",
  alt: "测试图片",
};

const audioAsset: MediaAsset = {
  id: "aud1",
  type: "audio",
  role: "prompt",
  source: "generated",
  url: "/media/test.mp3",
  alt: "音频提示",
};

const videoAsset: MediaAsset = {
  id: "vid1",
  type: "video",
  role: "prompt",
  source: "prepared",
  url: "/media/test.mp4",
  alt: "视频提示",
};

describe("MediaPromptBlock", () => {
  it("渲染带 src 和 alt 的图片", () => {
    const wrapper = mount(MediaPromptBlock, { props: { asset: imageAsset } });
    const img = wrapper.find("img");
    expect(img.exists()).toBe(true);
    expect(img.attributes("src")).toBe("/media/test.png");
    expect(img.attributes("alt")).toBe("测试图片");
  });

  it("渲染带 controls 的音频", () => {
    const wrapper = mount(MediaPromptBlock, { props: { asset: audioAsset } });
    const audio = wrapper.find("audio");
    expect(audio.exists()).toBe(true);
    expect(audio.attributes("controls")).toBeDefined();
  });

  it("渲染带 controls 的视频", () => {
    const wrapper = mount(MediaPromptBlock, { props: { asset: videoAsset } });
    const video = wrapper.find("video");
    expect(video.exists()).toBe(true);
    expect(video.attributes("controls")).toBeDefined();
  });

  it("显示 alt 文本", () => {
    const wrapper = mount(MediaPromptBlock, { props: { asset: audioAsset } });
    expect(wrapper.text()).toContain("音频提示");
  });
});
