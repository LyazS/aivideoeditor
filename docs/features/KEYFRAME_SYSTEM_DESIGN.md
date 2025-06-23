# 关键帧系统设计文档

## 📋 概述

关键帧系统为视频编辑器提供属性动画功能，支持在时间轴上为clip的各种属性（位置、大小、旋转、透明度等）设置关键帧，实现平滑的属性变化动画。

## 🎯 核心设计理念

### 统一数据流向
保持与现有系统一致的数据流向：
```
UI确认数值 → 添加/更新关键帧 → 设置进webav → sprite同步属性到timelineitem → 反馈到UI显示
```

### 关键帧状态管理
每个clip可以有两种状态：
- **无关键帧状态**：属性值直接应用到整个clip，行为与当前完全一致
- **有关键帧状态**：属性值在特定时间点设置关键帧，支持动画插值

### 多属性关键帧
一个关键帧可以包含多个属性值，避免数据冗余，提高存储和计算效率。

## 🏗️ 数据结构设计

### 1. 核心数据结构

```typescript
// 单个关键帧 - 可以包含多个属性
interface Keyframe {
  id: string
  time: number // 相对于clip开始的时间（秒）
  properties: Record<string, any> // 该时间点的所有属性值
  interpolation?: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'step' // 到下一个关键帧的插值方式
}

// clip的关键帧数据
interface ClipKeyframes {
  version: number // 数据版本，用于未来升级兼容
  hasKeyframes: boolean // 该clip是否启用了关键帧模式
  keyframes: Keyframe[] // 按时间排序的关键帧数组
  enabledProperties: Set<string> // 启用关键帧的属性列表
}

// 扩展TimelineItem
export interface TimelineItem {
  // ... 现有属性
  keyframes?: ClipKeyframes // 可选字段，保证向后兼容
}

// 支持不同类型的关键帧值
export type KeyframeValue = 
  | number // 单值：opacity, rotation, volume
  | { x: number; y: number } // 位置
  | { width: number; height: number } // 尺寸
```

### 2. 数据结构示例

```typescript
// 示例：一个关键帧包含多个属性
const keyframe: Keyframe = {
  id: "kf_001",
  time: 2.5, // 2.5秒时
  properties: {
    x: 100,
    y: 200,
    opacity: 0.8,
    rotation: 0.5,
    width: 300,
    height: 200
  },
  interpolation: 'ease'
}

// 示例：clip的完整关键帧数据
const clipKeyframes: ClipKeyframes = {
  version: 1,
  hasKeyframes: true,
  enabledProperties: new Set(['x', 'y', 'opacity', 'rotation']),
  keyframes: [
    {
      id: "kf_001",
      time: 0, // 开始时
      properties: { x: 0, y: 0, opacity: 1, rotation: 0 }
    },
    {
      id: "kf_002", 
      time: 2.5, // 2.5秒时
      properties: { x: 100, y: 200, opacity: 0.8, rotation: 0.5 }
    },
    {
      id: "kf_003",
      time: 5.0, // 5秒时
      properties: { x: 200, y: 100, opacity: 0.3, rotation: 1.0 }
    }
  ]
}
```

## 🔧 关键帧管理模块

### 1. 核心方法设计

```typescript
export function createKeyframeModule() {
  // 检查clip是否启用关键帧
  function hasKeyframes(timelineItemId: string): boolean
  
  // 检查特定属性是否启用关键帧
  function isPropertyKeyframed(timelineItemId: string, property: string): boolean
  
  // 启用clip的关键帧模式
  function enableKeyframes(
    timelineItemId: string, 
    properties: string[], 
    currentTime: number, 
    currentValues: Record<string, any>
  ): void
  
  // 在指定时间设置关键帧
  function setKeyframe(
    timelineItemId: string, 
    time: number, 
    properties: Record<string, any>
  ): void
  
  // 获取指定时间的插值属性值
  function getValuesAtTime(
    timelineItemId: string, 
    time: number
  ): Record<string, any> | null
  
  // 添加属性到关键帧系统
  function addPropertyToKeyframes(
    timelineItemId: string, 
    property: string, 
    currentTime: number, 
    currentValue: any
  ): void
}
```

## 🎨 UI组件设计

### 1. 关键帧钻石按钮

```vue
<!-- KeyframeButton.vue -->
<template>
  <button 
    class="keyframe-button"
    :class="{ 
      'has-keyframes': buttonState === 'active',
      'available-keyframes': buttonState === 'available',
      'current-keyframe': isCurrentKeyframe 
    }"
    @click="toggleKeyframe"
    :title="buttonTitle"
  >
    <svg class="diamond-icon" viewBox="0 0 12 12">
      <path d="M6 1 L11 6 L6 11 L1 6 Z" />
    </svg>
  </button>
</template>
```

### 2. 钻石按钮状态

- **空心钻石**：clip无关键帧
- **半实心钻石**：clip有关键帧但该属性未启用
- **实心钻石**：该属性已启用关键帧
- **高亮钻石**：当前时间点有关键帧

### 3. 属性面板集成

```vue
<div class="property-item">
  <label>位置</label>
  <div class="property-controls">
    <div class="position-controls">
      <!-- 现有的X、Y输入框 -->
    </div>
    <KeyframeButton 
      :timeline-item-id="selectedTimelineItem.id"
      property="position"
      :current-time="videoStore.currentTime"
      @keyframe-changed="handleKeyframeChange"
    />
  </div>
</div>
```

## 🔄 用户交互流程

### 1. 首次启用关键帧

1. 用户点击任意属性旁边的空心钻石按钮
2. 系统收集当前所有属性值
3. 创建第一个关键帧（包含所有属性的当前值）
4. 将点击的属性标记为启用状态
5. 钻石按钮变为实心，其他属性的钻石变为半实心

### 2. 添加属性到关键帧

1. 用户点击半实心钻石按钮
2. 将该属性添加到启用列表
3. 为所有现有关键帧补充该属性的当前值
4. 钻石按钮变为实心

### 3. 修改属性值

1. 用户在属性面板修改数值
2. 系统检查该属性是否启用关键帧
3. 如果启用：在当前时间创建/更新关键帧
4. 如果未启用：直接应用到sprite（现有行为）

### 4. 播放时的动画

1. 播放头移动触发时间更新
2. 系统计算所有有关键帧clip的当前插值
3. 将插值结果应用到sprite
4. UI自动更新显示插值后的属性值

## 💾 数据存储和持久化

### 1. 数据存放位置

关键帧数据直接存储在TimelineItem中：
- 保证数据一致性
- 便于序列化和备份
- 完全兼容现有的操作记录系统

### 2. 序列化策略

```typescript
// 使用纯数据结构，避免复杂对象
interface SerializableClipKeyframes {
  version: number
  hasKeyframes: boolean
  keyframes: Keyframe[]
  enabledProperties: string[] // Set转换为数组进行序列化
}
```

### 3. 版本管理

```typescript
const KEYFRAME_DATA_VERSION = 1

function migrateKeyframeData(keyframes: any): ClipKeyframes {
  if (!keyframes.version || keyframes.version < KEYFRAME_DATA_VERSION) {
    return migrateFromV0ToV1(keyframes)
  }
  return keyframes
}
```

## 🔄 操作记录系统适配

### 1. 扩展现有命令

```typescript
export class UpdateTransformCommand implements SimpleCommand {
  private oldKeyframeState?: {
    hasKeyframes: boolean
    keyframesData: ClipKeyframes | null
  }
  
  constructor(
    // ... 现有参数
    private currentTime?: number,
    private isKeyframeOperation?: boolean
  ) {
    // 保存关键帧状态用于撤销
    const item = this.timelineModule.getTimelineItem(timelineItemId)
    if (item) {
      this.oldKeyframeState = {
        hasKeyframes: !!item.keyframes?.hasKeyframes,
        keyframesData: item.keyframes ? 
          JSON.parse(JSON.stringify(item.keyframes)) : null
      }
    }
  }
}
```

### 2. 关键帧专用命令

```typescript
// 启用关键帧命令
export class EnableKeyframesCommand implements SimpleCommand {
  constructor(
    private timelineItemId: string,
    private property: string,
    private currentTime: number,
    private currentValue: any
  ) {
    this.description = `启用关键帧: ${property}`
  }
}

// 批量关键帧操作命令
export class BatchKeyframeCommand extends BaseBatchCommand {
  constructor(operations: KeyframeOperation[]) {
    super(`批量关键帧操作 ${operations.length} 项`)
  }
}
```

### 3. 操作描述优化

```typescript
private generateDescription(mediaName: string): string {
  const descriptions = []
  
  if (this.isKeyframeOperation) {
    descriptions.push('关键帧')
  }
  
  // 现有的属性描述逻辑
  if (this.newValues.position) descriptions.push('位置')
  if (this.newValues.opacity !== undefined) descriptions.push('透明度')
  
  const timeInfo = this.currentTime ? 
    ` (${TimecodeUtils.webAVToTimecode(this.currentTime * 1000000)})` : ''
  return `${descriptions.join('、')}: ${mediaName}${timeInfo}`
}
```

## 🚀 实现阶段规划

### 阶段1：基础架构
- [ ] 定义关键帧数据结构
- [ ] 创建关键帧管理模块
- [ ] 扩展TimelineItem接口
- [ ] 基础的启用/禁用功能

### 阶段2：UI组件
- [ ] 实现关键帧钻石按钮组件
- [ ] 集成到属性面板
- [ ] 实现按钮状态逻辑
- [ ] 添加交互反馈

### 阶段3：核心功能
- [ ] 实现关键帧设置和更新
- [ ] 实现插值计算
- [ ] 集成播放时的动画更新
- [ ] 测试基础动画功能

### 阶段4：操作记录集成
- [ ] 扩展现有命令类
- [ ] 实现关键帧操作的撤销重做
- [ ] 优化操作描述
- [ ] 测试历史记录功能

### 阶段5：高级功能
- [ ] 支持多种插值类型
- [ ] 关键帧复制粘贴
- [ ] 批量关键帧操作
- [ ] 性能优化

## 🔧 技术考虑

### 1. 性能优化
- 关键帧计算缓存
- 按帧缓存插值结果
- 只在需要时计算插值

### 2. 兼容性保证
- 可选字段确保向后兼容
- 渐进式功能启用
- 数据版本管理

### 3. 扩展性设计
- 支持新的属性类型
- 支持自定义插值函数
- 为高级功能预留接口

## 📝 总结

这个关键帧系统设计具有以下优势：

1. **数据结构合理**：一个关键帧包含多个属性，符合用户心理模型
2. **完全兼容现有系统**：不破坏任何现有功能
3. **操作记录无缝集成**：复用现有的命令模式和历史管理
4. **渐进式实现**：可以分阶段实现，不需要一次性完成
5. **性能可控**：关键帧计算只在需要时执行
6. **扩展性强**：为未来的高级功能预留空间

通过这个设计，用户可以轻松地为clip添加动画效果，同时保持与现有编辑功能的一致性和兼容性。
