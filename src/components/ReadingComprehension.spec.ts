import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ReadingComprehension from './ReadingComprehension.vue';
import type { ItemData } from '@/types';

function makeData(overrides: Partial<ItemData> = {}): ItemData {
  return {
    question_type: 'reading_comprehension',
    scene: '阅读',
    grammar_focus: '',
    target_level: 'HSK4',
    question_text: '根据文章回答问题',
    reading_passage: '这是一段很长的中文阅读材料，用于测试学生的阅读理解能力。文章内容涉及日常生活、文化习俗和社会现象。',
    sub_questions: [
      { sub_id: '1', question_text: '文章主要讲了什么？', answer_format: 'text' },
    ],
    ...overrides,
  };
}

describe('ReadingComprehension mobile layout', () => {
  it('renders reading passage and question', () => {
    const wrapper = mount(ReadingComprehension, { props: { data: makeData() } });

    expect(wrapper.text()).toContain('阅读材料');
    expect(wrapper.text()).toContain('这是一段很长的中文阅读材料');
    expect(wrapper.text()).toContain('根据文章回答问题');
  });

  it('renders sub-questions with input fields', () => {
    const wrapper = mount(ReadingComprehension, { props: { data: makeData() } });

    expect(wrapper.text()).toContain('文章主要讲了什么？');
    expect(wrapper.find('input').exists()).toBe(true);
  });

  it('wraps long unbroken text in reading passage', () => {
    // Simulate a very long unbroken string that would overflow without break-words
    const longText = '这是一个非常长的没有空格的中文句子用来测试文本是否会在移动端屏幕上正确地换行而不是溢出容器边界导致用户需要水平滚动才能看到完整内容'.repeat(3);
    const wrapper = mount(ReadingComprehension, {
      props: { data: makeData({ reading_passage: longText }) },
    });

    const passageEl = wrapper.find('p');
    expect(passageEl.text()).toContain('这是一个非常长的没有空格的中文句子');

    // The passage should have whitespace-pre-wrap for formatting
    expect(passageEl.classes()).toContain('whitespace-pre-wrap');
  });

  it('renders submit button disabled until all sub-questions answered', () => {
    const wrapper = mount(ReadingComprehension, { props: { data: makeData() } });

    const submitBtn = wrapper.find('button');
    expect(submitBtn.attributes('disabled')).toBeDefined();
  });

  it('enables submit and emits answer when all sub-questions filled', async () => {
    const wrapper = mount(ReadingComprehension, { props: { data: makeData() } });

    const input = wrapper.find('input');
    await input.setValue('这是一段测试回答');
    expect(input.element.value).toBe('这是一段测试回答');

    const submitBtn = wrapper.find('button');
    expect(submitBtn.attributes('disabled')).toBeUndefined();

    await submitBtn.trigger('click');
    expect(wrapper.emitted('submit')).toBeTruthy();
  });
});
