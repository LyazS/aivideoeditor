# 关键帧动画方案设计文档

## 1. 方案概述

基于现有项目架构，设计一个完整的关键帧动画系统，支持时间轴clip的属性动画。系统将利用WebAV的setAnimation接口，结合现有的帧数计算体系，实现从UI操作到WebAV动画的完整流程。

## 2. 核心设计理念

### 2.1 数据流向
```
属性面板钻石框选中 → 创建关键帧 → 帧数转百分比 → WebAV.setAnimation → WebAV执行动画 → propsChange事件 → 同步到TimelineItem
```

### 2.2 时间单位统一
- **内部计算**: 全部使用帧数（frames）
- **WebAV接口**: 转换为百分比格式和微秒
- **用户界面**: 显示时码格式

### 2.3 动画执行机制
- **WebAV是动画执行者**: 负责所有插值计算和属性更新
- **TimelineItem是被动接收者**: 通过propsChange事件同步状态
- **关键帧是配置数据**: 仅用于生成WebAV动画配置

## 3. 数据结构设计

### 3.1 关键帧数据结构
```typescript
/**
 * 关键帧数据结构
 * 一个关键帧可以包含多个属性的值
 */
interface Keyframe {
  frame: number;           // 关键帧位置（帧数）
  properties: {            // 该关键帧包含的所有属性值
    position?: { x: number; y: number };    // 位置（作为整体）
    size?: { width: number; height: number }; // 尺寸（作为整体）
    rotation?: number;      // 旋转角度
    opacity?: number;       // 透明度
  };
}

/**
 * 动画配置
 * 包含该TimelineItem的所有动画信息
 */
interface AnimationConfig {
  keyframes: Keyframe[];           // 关键帧数组
  isEnabled: boolean;              // 是否启用动画
  duration: number;                // 动画总时长（帧数）
  easing?: string;                 // 缓动函数（预留）
  loop?: boolean;                  // 是否循环（预留）
}
```

### 3.2 UI状态管理
```typescript
/**
 * 属性动画状态（UI层面）
 * 用于管理属性面板的钻石框状态
 */
interface PropertyAnimationState {
  [propertyName: string]: {
    hasKeyframes: boolean;     // 该属性是否在任何关键帧中有值
    isRecording: boolean;      // 是否处于录制状态（钻石框选中）
    isDirty: boolean;         // 属性值是否已修改但未保存为关键帧
  };
}

// 支持的动画属性
type AnimatableProperty = 'position' | 'size' | 'rotation' | 'opacity';

/**
 * WebAV动画配置格式
 * 用于转换给WebAV的setAnimation接口
 */
interface WebAVAnimationConfig {
  keyframes: Record<string, Record<string, number>>;  // { '0%': { x: 100, y: 100 }, '50%': { x: 200, y: 200 } }
  options: {
    duration: number;        // 动画时长（微秒）
    iterCount: number;       // 迭代次数
    easing?: string;         // 缓动函数
  };
}
```

### 3.3 TimelineItem 扩展
```typescript
/**
 * 时间轴项目接口（扩展动画支持）
 */
interface TimelineItem {
  // ... 现有属性保持不变
  id: string
  mediaItemId: string
  trackId: number
  mediaType: MediaType
  timeRange: VideoTimeRange | ImageTimeRange
  sprite: Raw<CustomSprite>

  // 现有的变换属性
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  opacity: number
  volume: number
  isMuted: boolean

  // 新增：动画配置（只存储数据，不存储UI状态）
  animation?: AnimationConfig;  // 动画配置（可选）
}
```

## 4. 核心功能模块

### 4.1 关键帧管理器 (KeyframeManager)
**职责**: 管理关键帧的增删改查
- 添加关键帧到指定帧位置
- 删除关键帧
- 更新关键帧属性值
- 合并多个属性到同一关键帧
- 生成WebAV动画配置

### 4.2 动画转换器 (AnimationConverter)
**职责**: 帧数与WebAV百分比格式的转换
- 将帧数关键帧转换为WebAV的百分比格式
- 计算相对于clip时长的百分比位置
- 处理时间范围边界情况
- 生成WebAV兼容的动画配置

### 4.3 属性同步器 (PropertySynchronizer)
**职责**: 同步WebAV动画状态到TimelineItem
- 监听WebAV的propsChange事件
- 将WebAV的属性变化同步到TimelineItem
- 确保TimelineItem属性与WebAV sprite状态一致
- **不负责插值计算**（由WebAV内部处理）

### 4.4 动画UI管理器 (AnimationUIManager)
**职责**: 管理属性面板的动画相关UI状态
- 通过 `useAnimationUI` composable 实现
- 钻石框选中状态管理
- 关键帧录制模式切换
- UI状态与数据模型分离
- 组件级别的状态管理

## 5. 工作流程设计

### 5.1 启用动画流程
1. 用户点击属性右侧的钻石框
2. `useAnimationUI` 切换该属性的录制状态
3. 检查当前TimelineItem是否已有animation配置
4. 如果没有，创建新的AnimationConfig
5. 在当前帧位置创建关键帧，包含当前属性值
6. 调用WebAV的setAnimation接口

### 5.2 添加关键帧流程
1. 用户移动时间轴到目标位置
2. 在属性面板修改属性值（任何处于recording状态的属性）
3. 检查当前帧是否已有关键帧
4. 如果有，更新该关键帧的属性值
5. 如果没有，创建新关键帧
6. 重新计算并更新WebAV动画

### 5.3 动画播放流程
1. WebAV播放时自动执行动画，更新sprite属性
2. WebAV触发propsChange事件，通知属性变化
3. PropertySynchronizer监听propsChange事件
4. 将WebAV的属性变化同步到TimelineItem
5. Vue的响应式系统自动更新属性面板显示值

### 5.4 禁用动画流程
1. 用户取消钻石框选中
2. `useAnimationUI` 更新该属性的录制状态
3. 如果所有属性都不再录制，清除整个动画配置
4. 调用WebAV清除动画
5. 恢复静态属性值

## 6. WebAV集成方案

### 6.1 setAnimation调用格式
```javascript
// 示例：位置动画
sprite.setAnimation(
  {
    '0%': { x: 100, y: 100 },
    '25%': { x: 200, y: 150 },
    '50%': { x: 300, y: 100 },
    '100%': { x: 100, y: 100 }
  },
  {
    duration: framesToMicroseconds(animationDurationFrames),
    iterCount: 1
  }
);
```

### 6.2 帧数到百分比转换算法
```typescript
function framesToPercentage(frame: number, clipStartFrame: number, clipDurationFrames: number): string {
  const relativeFrame = frame - clipStartFrame;
  const percentage = (relativeFrame / clipDurationFrames) * 100;
  return `${Math.max(0, Math.min(100, percentage))}%`;
}

function convertToWebAVAnimation(animationConfig: AnimationConfig, timeRange: VideoTimeRange | ImageTimeRange): WebAVAnimationConfig {
  const webavKeyframes: Record<string, Record<string, number>> = {};

  animationConfig.keyframes.forEach(keyframe => {
    const percentage = framesToPercentage(keyframe.frame, timeRange.timelineStartTime, animationConfig.duration);
    const webavProps: Record<string, number> = {};

    // 转换位置属性
    if (keyframe.properties.position) {
      webavProps.x = keyframe.properties.position.x;
      webavProps.y = keyframe.properties.position.y;
    }

    // 转换尺寸属性
    if (keyframe.properties.size) {
      webavProps.w = keyframe.properties.size.width;
      webavProps.h = keyframe.properties.size.height;
    }

    // 转换其他属性
    if (keyframe.properties.rotation !== undefined) {
      webavProps.angle = keyframe.properties.rotation;
    }

    if (keyframe.properties.opacity !== undefined) {
      webavProps.opacity = keyframe.properties.opacity;
    }

    webavKeyframes[percentage] = webavProps;
  });

  return {
    keyframes: webavKeyframes,
    options: {
      duration: framesToMicroseconds(animationConfig.duration),
      iterCount: 1,
      easing: animationConfig.easing
    }
  };
}
```

## 7. 用户界面设计

### 7.1 属性面板增强
- 每个可动画属性右侧添加钻石形状的动画开关
- 钻石框选中时高亮显示（如金色或蓝色）
- 显示当前是否处于关键帧位置
- 提供关键帧导航按钮

### 7.2 时间轴增强
- 在时间轴上显示关键帧标记
- 不同属性使用不同颜色的标记
- 支持点击跳转到关键帧位置
- 提供关键帧右键菜单（删除、复制等）

### 7.3 动画预览
- 实时预览动画效果
- 支持动画播放/暂停控制
- 提供动画速度调节

## 8. 性能优化考虑

### 8.1 批量更新
- 多个属性同时变化时，批量调用setAnimation
- 避免频繁的WebAV接口调用

### 8.2 内存管理
- 及时清理不再使用的动画数据
- 使用对象池管理关键帧对象

### 8.3 计算优化
- 缓存百分比转换结果
- 使用防抖处理频繁的属性更新

## 9. 扩展性设计

### 9.1 动画曲线支持
- 预留接口支持缓动函数
- 支持自定义动画曲线

### 9.2 动画模板
- 支持保存和加载动画预设
- 提供常用动画模板库

### 9.3 高级功能
- 支持动画分组
- 支持动画继承和覆盖
- 支持动画事件回调

## 10. 实现优先级

### 第一阶段（核心功能）
1. 在 `types/index.ts` 中添加动画相关类型定义
2. 扩展 `TimelineItem` 接口，添加 `animation?: AnimationConfig`
3. 实现 `useAnimationUI` composable
4. 创建基础的关键帧管理工具函数

### 第二阶段（UI集成）
1. 在 `PropertiesPanel.vue` 中集成钻石框UI
2. 实现属性录制状态切换逻辑
3. 添加关键帧创建和更新功能
4. 在时间轴上显示关键帧标记

### 第三阶段（WebAV集成）
1. 实现动画转换器，将帧数转换为WebAV百分比格式
2. 集成 `sprite.setAnimation()` 调用
3. 实现属性同步器，监听propsChange事件并同步到TimelineItem
4. 确保WebAV动画与TimelineItem状态的一致性

### 第四阶段（优化完善）
1. 性能优化（批量更新、缓存等）
2. 用户体验优化（动画预览、关键帧导航等）
3. 错误处理和边界情况
4. 高级功能（缓动函数、动画模板等）

## 11. 技术实现细节

### 11.1 动画UI状态管理
使用 Vue 3 组合式API实现UI状态管理：

```typescript
// composables/useAnimationUI.ts
export function useAnimationUI(timelineItem: Ref<TimelineItem | null>) {
  const animationState = ref<PropertyAnimationState>({})

  // 根据动画数据计算UI状态
  const updateAnimationState = () => {
    if (!timelineItem.value?.animation) {
      animationState.value = {}
      return
    }

    const newState: PropertyAnimationState = {}
    const properties: AnimatableProperty[] = ['position', 'size', 'rotation', 'opacity']

    properties.forEach(property => {
      newState[property] = {
        hasKeyframes: hasPropertyKeyframes(timelineItem.value!, property),
        isRecording: false, // 默认不录制
        isDirty: false
      }
    })

    animationState.value = newState
  }

  // 切换属性录制状态（钻石框点击）
  const togglePropertyRecording = (property: string) => {
    if (!animationState.value[property]) {
      animationState.value[property] = {
        hasKeyframes: false,
        isRecording: false,
        isDirty: false
      }
    }

    animationState.value[property].isRecording = !animationState.value[property].isRecording

    // 如果开启录制且没有关键帧，创建初始关键帧
    if (animationState.value[property].isRecording && !animationState.value[property].hasKeyframes) {
      createInitialKeyframe(property)
    }
  }

  // 监听 timelineItem 变化，更新UI状态
  watch(timelineItem, updateAnimationState, { immediate: true, deep: true })

  return {
    animationState: readonly(animationState),
    togglePropertyRecording,
    updateAnimationState
  }
}
```

### 11.2 WebAV 动画执行机制
系统中的动画执行完全由 WebAV 负责，不需要手动计算插值：

```typescript
// WebAV 动画执行流程：
// 1. 将关键帧转换为 WebAV 格式并调用 setAnimation
const webavConfig = convertToWebAVAnimation(animationConfig, timeRange)
sprite.setAnimation(webavConfig.keyframes, webavConfig.options)

// 2. WebAV 在播放时自动更新 sprite 属性
// 3. 通过 propsChange 事件同步到 TimelineItem
sprite.on('propsChange', (changedProps: PropsChangeEvent) => {
  if (changedProps.rect) {
    // 更新 TimelineItem 的属性
    timelineItem.x = changedProps.rect.x
    timelineItem.y = changedProps.rect.y
    // ... 其他属性
  }
})
```

**重要说明**：
- ✅ **WebAV 负责插值计算**：所有动画的中间值都由 WebAV 内部计算
- ✅ **TimelineItem 被动更新**：通过监听 `propsChange` 事件更新属性
- ✅ **关键帧仅用于配置**：关键帧数据只用于生成 WebAV 动画配置
- ❌ **不需要手动插值**：系统不需要实现自己的插值算法

### 11.3 类型守卫和工具函数
```typescript
/**
 * 检查时间轴项目是否有动画
 */
export function hasAnimation(item: TimelineItem): boolean {
  return !!(item.animation && item.animation.isEnabled && item.animation.keyframes.length > 0)
}

/**
 * 检查属性是否有关键帧
 */
export function hasPropertyKeyframes(item: TimelineItem, property: AnimatableProperty): boolean {
  if (!item.animation) return false
  return item.animation.keyframes.some(keyframe =>
    keyframe.properties.hasOwnProperty(property)
  )
}

/**
 * 获取指定帧位置的关键帧
 */
export function getKeyframeAtFrame(item: TimelineItem, frame: number): Keyframe | undefined {
  if (!item.animation) return undefined
  return item.animation.keyframes.find(keyframe => keyframe.frame === frame)
}

/**
 * 创建或更新关键帧
 */
export function setKeyframeProperty(
  item: TimelineItem,
  frame: number,
  property: AnimatableProperty,
  value: any
): void {
  if (!item.animation) {
    item.animation = {
      keyframes: [],
      isEnabled: true,
      duration: 0
    }
  }

  // 查找现有关键帧或创建新的
  let keyframe = item.animation.keyframes.find(kf => kf.frame === frame)
  if (!keyframe) {
    keyframe = { frame, properties: {} }
    item.animation.keyframes.push(keyframe)
    item.animation.keyframes.sort((a, b) => a.frame - b.frame)
  }

  // 设置属性值
  keyframe.properties[property] = value

  // 更新动画时长
  const maxFrame = Math.max(...item.animation.keyframes.map(kf => kf.frame))
  item.animation.duration = maxFrame
}

/**
 * 设置位置关键帧
 */
export function setPositionKeyframe(item: TimelineItem, frame: number, x: number, y: number): void {
  setKeyframeProperty(item, frame, 'position', { x, y })
}

/**
 * 设置尺寸关键帧
 */
export function setSizeKeyframe(item: TimelineItem, frame: number, width: number, height: number): void {
  setKeyframeProperty(item, frame, 'size', { width, height })
}
```

## 12. 错误处理和边界情况

### 12.1 数据验证
- 关键帧位置不能超出clip时间范围
- 属性值必须在合理范围内
- 防止无效的动画配置

### 12.2 异常恢复
- WebAV接口调用失败时的回退机制
- 动画数据损坏时的修复策略
- 用户操作错误的撤销功能

### 12.3 兼容性处理
- 处理不同浏览器的WebCodecs支持差异
- 确保动画在不同设备上的一致性表现

## 13. 使用场景示例

### 13.1 创建简单的位移动画
```typescript
// 在第0帧创建初始关键帧
const initialKeyframe: Keyframe = {
  frame: 0,
  properties: {
    position: { x: 100, y: 100 },
    opacity: 1.0
  }
}

// 在第60帧创建结束关键帧
const endKeyframe: Keyframe = {
  frame: 60,
  properties: {
    position: { x: 300, y: 200 },
    opacity: 0.5
  }
}

// 动画配置
const animationConfig: AnimationConfig = {
  keyframes: [initialKeyframe, endKeyframe],
  isEnabled: true,
  duration: 60, // 60帧
}
```

### 13.2 在组件中使用动画UI
```vue
<script setup lang="ts">
import { useAnimationUI } from '../composables/useAnimationUI'

const selectedTimelineItem = computed(() => videoStore.getSelectedTimelineItem())
const { animationState, togglePropertyRecording } = useAnimationUI(selectedTimelineItem)

// 钻石框点击处理
const handleAnimationToggle = (property: string) => {
  togglePropertyRecording(property)
}
</script>

<template>
  <!-- 位置属性控件 -->
  <div class="property-group">
    <div class="property-item">
      <label>位置</label>
      <div class="position-controls">
        <NumberInput :model-value="transformX" @change="updatePosition" />
        <NumberInput :model-value="transformY" @change="updatePosition" />
      </div>
      <!-- 钻石框 -->
      <button
        class="animation-toggle"
        :class="{
          active: animationState.position?.isRecording,
          hasKeyframes: animationState.position?.hasKeyframes
        }"
        @click="handleAnimationToggle('position')"
      >
        ◆
      </button>
    </div>
  </div>

  <!-- 尺寸属性控件 -->
  <div class="property-group">
    <div class="property-item">
      <label>尺寸</label>
      <div class="size-controls">
        <NumberInput :model-value="width" @change="updateSize" />
        <NumberInput :model-value="height" @change="updateSize" />
      </div>
      <!-- 钻石框 -->
      <button
        class="animation-toggle"
        :class="{
          active: animationState.size?.isRecording,
          hasKeyframes: animationState.size?.hasKeyframes
        }"
        @click="handleAnimationToggle('size')"
      >
        ◆
      </button>
    </div>
  </div>
</template>
```

## 14. 架构优势

### 14.1 数据与UI分离
- **TimelineItem** 只存储纯动画数据（AnimationConfig）
- **UI状态** 通过 `useAnimationUI` composable 管理
- 便于测试、维护和数据持久化

### 14.2 关键帧设计优势
- **一个关键帧包含多个属性**：保持时间点的完整性
- **关键帧按时间排序**：便于生成WebAV动画配置
- **简化的数据结构**：易于理解和维护
- **配置与执行分离**：关键帧只负责配置，WebAV负责执行

### 14.3 模块化设计
- 遵循现有的模块化架构
- 可以独立开发和测试各个功能模块
- 便于后续扩展和优化

## 15. 重要架构说明

### 15.1 动画执行机制
本系统采用**WebAV驱动**的动画架构：
- ✅ **WebAV负责动画执行**：所有插值计算、时间控制都由WebAV内部处理
- ✅ **关键帧仅用于配置**：系统的关键帧数据只用于生成WebAV动画配置
- ✅ **被动属性同步**：TimelineItem通过propsChange事件被动接收WebAV的属性更新
- ❌ **不需要手动插值**：系统不实现自己的动画插值算法

### 15.2 数据流向
```
用户操作 → 关键帧数据 → WebAV配置 → WebAV执行 → propsChange → TimelineItem更新 → UI显示
```

这种架构确保了：
- 动画的准确性和性能（由WebAV保证）
- 系统的简洁性（不重复实现动画引擎）
- 状态的一致性（WebAV是唯一的真实来源）

---

**注意**: 本方案充分利用了WebAV的动画能力和现有的帧数计算体系，通过propsChange事件驱动的架构确保了动画状态的一致性。数据与UI状态分离的设计保证了系统的可维护性和可测试性。实现时应遵循渐进式开发原则，先实现核心功能，再逐步完善高级特性。
