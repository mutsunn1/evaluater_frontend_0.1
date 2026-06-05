import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ThinkingProcess from './ThinkingProcess.vue';

describe('ThinkingProcess 思考气泡', () => {
  it('应优先显示具体题目摘要，而不是只显示最后两条完成状态', () => {
    const wrapper = mount(ThinkingProcess, {
      props: {
        steps: [
          {
            agent: '出题规划摘要',
            agent_key: 'thinking_coordinator',
            output: '系统正在选择适合当前水平的语法题。',
          },
          {
            agent: '题目摘要',
            agent_key: 'system',
            output: '本题围绕把字句的语序、结构和语义是否成立进行辨析。',
          },
          {
            agent: '质检智能体',
            agent_key: 'item_qa_agent',
            output: '[grammar] 题目质量检查完成。',
          },
          {
            agent: 'grammar出题',
            agent_key: 'grammar_generator',
            output: '[grammar] 题目生成完成。',
          },
        ],
      },
    });

    expect(wrapper.text()).toContain('本题围绕把字句');
    expect(wrapper.text()).not.toContain('[grammar] 题目质量检查完成。');
    expect(wrapper.text()).not.toContain('[grammar] 题目生成完成。');
  });
});
