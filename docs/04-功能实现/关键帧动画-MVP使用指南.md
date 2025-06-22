# 关键帧动画系统 MVP 使用指南

## 📋 概述

关键帧动画系统MVP版本已经实现，提供了基础的关键帧创建、编辑和播放功能。系统完全基于WebAV的setAnimation API，确保高性能和原生兼容性。

## 🏗️ 架构组成

### 核心文件

1. **类型定义**: `frontend/src/types/animationTypes.ts`
   - 完整的动画类型定义
   - WebAV集成类型
   - 操作和事件类型

2. **格式转换器**: `frontend/src/utils/webavAnimationConverter.ts`
   - 项目格式 ↔ WebAV格式转换
   - 关键帧验证
   - 默认配置创建

3. **动画管理器**: `frontend/src/utils/keyFrameAnimationManager.ts`
   - 关键帧CRUD操作
   - 动画应用和清除
   - 时间计算

4. **工具函数**: `frontend/src/utils/animationUtils.ts`
   - 时间转换
   - 属性值计算
   - 关键帧查找

5. **组合函数**: `frontend/src/composables/useKeyFrameAnimation.ts`
   - 响应式动画管理
   - 组件级API封装

6. **UI组件**: `frontend/src/components/AnimationControls.vue`
   - 关键帧编辑界面
   - 属性控制面板

## 🚀 快速开始

### 1. 基础使用

```typescript
import { useKeyFrameAnimation } from '@/composables/useKeyFrameAnimation'

// 在组件中使用
const {
  setSelectedTimelineItem,
  createKeyFrame,
  hasKeyFrameAtTime,
  setAnimationEnabled
} = useKeyFrameAnimation()

// 设置要操作的时间轴项目
setSelectedTimelineItem(timelineItem)

// 启用动画
setAnimationEnabled(true)

// 创建关键帧
createKeyFrame('x', 100) // 在当前时间为x属性创建值为100的关键帧
```

### 2. 在组件中集成

```vue
<template>
  <div>
    <!-- 其他内容 -->
    <AnimationControls :timeline-item="selectedTimelineItem" />
  </div>
</template>

<script setup>
import AnimationControls from '@/components/AnimationControls.vue'
import { ref } from 'vue'

const selectedTimelineItem = ref(null)
</script>
```

## 🎯 核心功能

### 1. 关键帧创建

```typescript
// 方式1：使用当前属性值和当前时间
createKeyFrame('opacity')

// 方式2：指定值和时间
createKeyFrame('x', 200, 1.5) // 在1.5秒时为x属性设置值200
```

### 2. 关键帧删除

```typescript
// 删除指定属性在当前时间的关键帧
removeKeyFrameProperty('rotation')

// 删除整个关键帧
removeKeyFrame(keyFrameId)
```

### 3. 动画控制

```typescript
// 启用/禁用动画
setAnimationEnabled(true)

// 设置动画时长（秒）
setAnimationDuration(3.0)

// 清除所有动画
clearAllAnimations()
```

### 4. 关键帧导航

```typescript
// 跳转到下一个关键帧
goToNextKeyFrame()

// 跳转到上一个关键帧
goToPrevKeyFrame()

// 检查当前时间是否有关键帧
const hasKeyFrame = hasKeyFrameAtTime('opacity')
```

## 📊 支持的属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `x` | number | X坐标位置（项目坐标系） |
| `y` | number | Y坐标位置（项目坐标系） |
| `width` | number | 宽度 |
| `height` | number | 高度 |
| `rotation` | number | 旋转角度（弧度） |
| `opacity` | number | 透明度（0-1） |

## 🔧 高级用法

### 1. 批量创建关键帧

```typescript
// 在同一时间点为多个属性创建关键帧
const properties = ['x', 'y', 'opacity']
properties.forEach(prop => {
  createKeyFrame(prop as AnimatableProperty)
})
```

### 2. 动画时间计算

```typescript
import { secondsToRelativeTime, relativeTimeToSeconds } from '@/utils/animationUtils'

// 将秒转换为动画相对时间（0-1）
const relativeTime = secondsToRelativeTime(1.5, 3000000) // 1.5秒在3秒动画中 = 0.5

// 将相对时间转换为秒
const seconds = relativeTimeToSeconds(0.5, 3000000) // 0.5在3秒动画中 = 1.5秒
```

### 3. 属性值插值

```typescript
import { getPropertyValueAtTime } from '@/utils/animationUtils'

// 获取指定时间的属性值（考虑动画插值）
const valueAt2Seconds = getPropertyValueAtTime(timelineItem, 'x', 2.0)
```

## 🎨 UI组件使用

`AnimationControls.vue` 提供了完整的关键帧编辑界面：

- ✅ 动画开关
- ⏱️ 动画时长设置
- 📊 属性值控制
- 💎 关键帧按钮（实心=有关键帧，空心=无关键帧）
- 🧭 关键帧导航
- 📋 关键帧列表

## 🔍 调试和监控

系统提供了详细的控制台日志：

```
🎬 [Animation] Applied animation to sprite: { keyFrameCount: 3, duration: 2000000, ... }
🎬 [Animation] Created keyframe: { property: 'x', value: 100, time: 1.5, result: 'added' }
🗑️ [Animation] Removed keyframe: { keyFrameId: '...', result: 'removed' }
🧹 [Animation] Cleared sprite animation
```

## ⚠️ 注意事项

1. **最少关键帧**: 动画至少需要2个关键帧才能生效
2. **时间范围**: 关键帧时间使用相对值（0-1），自动映射到动画周期
3. **属性同步**: 修改TimelineItem属性会自动同步到WebAV Sprite
4. **内存管理**: 使用markRaw避免Vue响应式包装WebAV对象

## 🚧 MVP限制

当前MVP版本的限制：

- 只支持线性插值（linear）
- 不支持缓动函数（easing）
- 不支持动画延迟（delay）
- 不支持批量操作
- 不支持动画导入导出

这些功能将在后续版本中逐步添加。

## 🔄 与现有系统集成

动画系统已完全集成到现有架构中：

- ✅ TimelineItem工厂函数支持
- ✅ 坐标系转换兼容
- ✅ WebAV Sprite同步
- ✅ Vue响应式支持
- ✅ 类型安全保证

可以直接在现有的时间轴项目上使用动画功能，无需额外配置。
