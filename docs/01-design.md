## 项目名
name: react-hook-pipeline
description: A React utility for dynamically composing Hook-enabled components via type-safe recursive rendering.

## Role
你是一位资深 React 架构师，精通 Hooks 规范、高阶组件（HOC）、Render Props 与类型安全设计。

## Scenario
我需要实现一个「动态 Processor 链」机制：
- 每个 Processor 是一个 React 组件（可调用 useState/useEffect 等 Hooks）
- Processor 接收 props，增强后通过 `children` 透传给下一个 Processor
- Processor 数组在运行时动态决定（如根据配置/权限注入）
- 最终渲染一个业务组件（如 Button/EditorAction）
- 必须遵守 Rules of Hooks：不能在 reduce/map 中调用 Hook

## Requirements
1. ✅ 完全符合 React Hooks 规范（调用顺序稳定）
2. ✅ 支持动态数组：processors 可在运行时增删/重排
3. ✅ 类型安全：使用泛型透传 baseProps 类型，ProcessorProps<T> 明确约束
4. ✅ children 透传机制：每个 Processor 必须渲染 props.children 以维持链式结构
5. ✅ 性能优化：支持 memo、useCallback，避免不必要的重渲染
6. ✅ 可扩展：支持链式上下文（$chain）、条件注入、调试模式
7. ✅ **命名抽象**：`ProcessorChain` 仅为参考名称，请根据设计意图发挥，选择更语义化/更抽象的组件名（如 `HookPipeline` / `ComposeEnhancers` / `RenderStack` / `EffectLayer` 等），并说明命名理由

## Deliverables
请提供：
1. 🧱 核心组件 `XXX.tsx`：递归实现 + 泛型 + memo 导出（名称由你设计）
2. 📐 类型定义：`Processor<T>`, `ProcessorProps<T>`, `XXXProps<T>`
3. 🛠️ 示例 Processor：如 WithLoading/WithTooltip/WithAnalytics（展示 Hook 使用 + children 透传）
4. 📦 使用示例：如何组合 processors 并渲染最终组件
5. ⚠️ 注意事项：无限递归防护、类型丢失、children 覆盖等边界处理
6. 🔄 方案对比：与「显式调用 Hook」「纯函数 reduce」的适用场景分析
7. 🏷️ 命名思考：简述你选择的组件名背后的设计哲学（如：强调「组合」/「管道」/「分层」/「增强」）

## Constraints
- 使用 TypeScript，开启 strict 模式
- 优先函数组件 + Hooks，避免 class 组件
- 代码需包含 JSDoc 注释，关键逻辑添加中文说明
- 避免使用 unstable 特性（如 use 实验性 API）
- 组件命名遵循 PascalCase，体现「职责单一」与「可组合性」

## Example Input/Output
Input:
```tsx
<YourComponentName
  baseProps={{ label: 'Save', onClick: save }}
  enhancers={[WithLoading, WithTooltip]}
  Target={Button}
/>
```

## Principle
```tsx
// components/ProcessorChain.tsx
import React, { ComponentType, memo } from 'react';

/**
 * Processor 组件的 Props 泛型
 * @template T - 透传的原始业务 props
 */
export type ProcessorProps<T = Record<string, any>> = 
  T & {
    children?: React.ReactNode;
    /** 可选：传递链式上下文（如最终组件、全局配置） */
    $chain?: {
      FinalComponent: ComponentType<T>;
      [key: string]: any;
    };
  };

/**
 * Processor 组件类型：接收增强后的 props，返回 JSX（含 children）
 */
export type Processor<T = Record<string, any>> = ComponentType<ProcessorProps<T>>;

/**
 * ProcessorChain 属性
 */
export interface ProcessorChainProps<T = Record<string, any>> {
  /** 初始业务数据（不包含 children） */
  baseProps: T;
  /** Processor 组件数组，按顺序执行 */
  processors: Processor<T>[];
  /** 最终渲染的原始组件 */
  FinalComponent: ComponentType<T>;
  /** 可选：全局链式上下文 */
  chainContext?: Record<string, any>;
}

/**
 * 递归渲染 Processor 链
 * 
 * 执行流程:
 * processors[0] → processors[1] → ... → FinalComponent
 * 
 * @example
 * <ProcessorChain
 *   baseProps={{ label: 'Save', onClick: handleSave }}
 *   processors={[WithLoading, WithTooltip, WithAnalytics]}
 *   FinalComponent={Button}
 * />
 */
function ProcessorChain<T extends Record<string, any>>({
  baseProps,
  processors,
  FinalComponent,
  chainContext = {},
}: ProcessorChainProps<T>) {
  // 🎯 递归终止：无剩余 processor，渲染最终组件
  if (processors.length === 0) {
    return <FinalComponent {...baseProps} />;
  }

  // 🔄 取出第一个 processor，剩余继续递归
  const [CurrentProcessor, ...remaining] = processors;

  // 合并链式上下文
  const chainProps = {
    ...baseProps,
    $chain: { FinalComponent, ...chainContext },
    // children 是下一个递归层（或最终组件）
    children: (
      <ProcessorChain
        baseProps={baseProps}
        processors={remaining}
        FinalComponent={FinalComponent}
        chainContext={chainContext}
      />
    ),
  };

  return <CurrentProcessor {...(chainProps as ProcessorProps<T>)} />;
}

// ✅ 导出带泛型推断的 memo 版本，避免重复渲染
export default memo(ProcessorChain) as <T extends Record<string, any>>(
  props: ProcessorChainProps<T>
) => ReturnType<typeof ProcessorChain>;
```
