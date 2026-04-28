/**
 * 基础渲染测试
 * 验证 ReactHookPipeline 组件的基本渲染行为，包括：
 * - 默认 className 是否正确应用
 * - 自定义 className 是否能正确合并
 * - children 内容是否正常渲染
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReactHookPipeline from '../src';

describe('ReactHookPipeline', () => {
  it('should render with default className', () => {
    render(<ReactHookPipeline>hello</ReactHookPipeline>);
    const el = screen.getByText('hello');
    expect(el).toBeInTheDocument();
    expect(el.closest('[data-component="react-hook-pipeline"]')).toBeInTheDocument();
  });

  it('should merge custom className', () => {
    const { container } = render(<ReactHookPipeline className="custom-class">test</ReactHookPipeline>);
    expect(container.firstChild).toHaveClass('react-hook-pipeline', 'custom-class');
  });

  it('should render children', () => {
    render(<ReactHookPipeline>child content</ReactHookPipeline>);
    expect(screen.getByText('child content')).toBeInTheDocument();
  });
});
