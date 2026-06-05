import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ConfidenceBar from './ConfidenceBar.vue';
import type { ConfidenceStats } from '@/types';

function makeStats(overrides: Partial<ConfidenceStats> = {}): ConfidenceStats {
  return {
    accuracy: 85,
    ci_lower: 0.8,
    ci_upper: 0.9,
    confidence: 0.75,
    sample_size: 12,
    should_stop: false,
    stop_reason: '',
    remaining: 6,
    total_rounds: 8,
    min_rounds: 5,
    max_rounds: 18,
    dimension_rounds: { vocabulary: 3, grammar: 3, reading: 2 },
    ...overrides,
  };
}

describe('ConfidenceBar mobile layout', () => {
  it('renders all dimension indicators and accuracy text without truncation', () => {
    const wrapper = mount(ConfidenceBar, {
      props: { stats: makeStats() },
    });

    const text = wrapper.text();
    expect(text).toContain('词汇');
    expect(text).toContain('语法');
    expect(text).toContain('阅读');
    expect(text).toContain('正确率');
    expect(text).toContain('置信度');
    expect(text).toContain('85%');
    expect(text).toContain('75%');
  });

  it('renders round progress', () => {
    const wrapper = mount(ConfidenceBar, {
      props: { stats: makeStats() },
    });

    expect(wrapper.text()).toContain('8 / 18 轮');
  });

  it('shows stop indicator when should_stop is true', () => {
    const wrapper = mount(ConfidenceBar, {
      props: { stats: makeStats({ should_stop: true }) },
    });

    expect(wrapper.text()).toContain('评测完成');
  });

  it('renders nothing visible when no rounds have been played', () => {
    const wrapper = mount(ConfidenceBar, {
      props: {
        stats: makeStats({ total_rounds: 0, sample_size: 0 }),
      },
    });

    expect(wrapper.text()).toBe('');
  });
});
