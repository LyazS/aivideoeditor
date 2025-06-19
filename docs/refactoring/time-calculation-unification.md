# 时间计算和对齐逻辑统一重构

## 📋 重构概述

本次重构解决了项目中时间计算和对齐逻辑重复的问题，通过创建统一的工具函数来提高代码的可维护性和一致性。

## 🔍 问题分析

### 重复逻辑发现

1. **`alignTimeToFrame` 函数重复**
   - `storeUtils.ts`: 标准实现，接受 `frameRate` 参数
   - `TimeScale.vue`: 本地实现，直接使用 `videoStore.frameRate`

2. **`pixelsPerSecond` 计算重复**
   - `TimeScale.vue`: `(containerWidth.value * videoStore.zoomLevel) / duration`
   - `Timeline.vue`: `(timelineWidth.value * videoStore.zoomLevel) / videoStore.totalDuration`
   - 多个地方重复计算相同的逻辑

3. **`formatTime` 函数重复**
   - `TimeScale.vue`: 复杂实现，根据缩放级别显示不同精度
   - `Timeline.vue`: 简单实现，固定显示分:秒.毫秒格式
   - `VideoPreviewEngine.vue`: 简单的分:秒格式
   - `VideoClip.vue`: 时长格式化
   - `playbackModule.ts`: 复杂的时分秒毫秒格式

4. **时间范围计算重复**
   - `TimeScale.vue`: 计算可见时间范围
   - `Timeline.vue`: 计算可见时间范围（用于网格线）

### 影响范围

- **主要文件**: `TimeScale.vue`, `Timeline.vue`, `storeUtils.ts`
- **扩展影响**: `VideoPreviewEngine.vue`, `VideoClip.vue`, `playbackModule.ts`, `useDragUtils.ts`, `useDragPreview.ts`

## 🛠️ 解决方案

### 新增统一工具函数

在 `storeUtils.ts` 中新增以下工具函数：

#### 1. `calculatePixelsPerSecond`
```typescript
export function calculatePixelsPerSecond(
  timelineWidth: number,
  totalDuration: number,
  zoomLevel: number,
): number
```
统一计算每秒像素数的逻辑。

#### 2. `calculateVisibleTimeRange`
```typescript
export function calculateVisibleTimeRange(
  timelineWidth: number,
  totalDuration: number,
  zoomLevel: number,
  scrollOffset: number,
  maxVisibleDuration?: number,
): { startTime: number; endTime: number }
```
统一计算可见时间范围的逻辑。

#### 3. `formatTime`
```typescript
export function formatTime(
  seconds: number,
  precision: 'frames' | 'milliseconds' | 'seconds' = 'seconds',
  frameRate: number = 30,
): string
```
统一的时间格式化函数，支持多种精度。

#### 4. `formatTimeWithAutoPrecision`
```typescript
export function formatTimeWithAutoPrecision(
  seconds: number,
  pixelsPerSecond: number,
  frameRate: number = 30,
): string
```
根据缩放级别自动选择时间显示精度。

## 📝 重构详情

### 文件更改列表

1. **`storeUtils.ts`**
   - ✅ 新增 4 个统一工具函数
   - ✅ 更新文档说明

2. **`TimeScale.vue`**
   - ✅ 导入统一工具函数
   - ✅ 替换 `pixelsPerSecond` 计算
   - ✅ 替换 `alignTimeToFrame` 实现
   - ✅ 替换 `formatTime` 实现
   - ✅ 替换可见时间范围计算

3. **`Timeline.vue`**
   - ✅ 导入统一工具函数
   - ✅ 替换 `pixelsPerSecond` 计算
   - ✅ 替换可见时间范围计算
   - ✅ 替换 `formatTime` 实现

4. **`VideoPreviewEngine.vue`**
   - ✅ 导入统一工具函数
   - ✅ 替换 `formatTime` 实现

5. **`VideoClip.vue`**
   - ✅ 导入统一工具函数
   - ✅ 替换 `formatDuration` 实现

6. **`playbackModule.ts`**
   - ✅ 导入统一工具函数
   - ✅ 优化 `formattedCurrentTime` 实现

7. **`README.md`**
   - ✅ 更新工具函数文档

## 🎯 重构效果

### 代码质量提升

1. **消除重复**: 移除了多个文件中的重复时间计算逻辑
2. **统一标准**: 所有时间相关计算使用统一的工具函数
3. **易于维护**: 时间计算逻辑集中管理，修改时只需更新一处
4. **类型安全**: 统一的函数签名和参数验证

### 功能一致性

1. **时间格式**: 所有组件使用一致的时间显示格式
2. **精度控制**: 根据缩放级别自动调整显示精度
3. **计算准确**: 统一的像素-时间转换逻辑

### 性能优化

1. **减少重复计算**: 避免在多个地方重复计算相同的值
2. **函数复用**: 提高代码执行效率

## 🔧 使用指南

### 导入方式
```typescript
import {
  calculatePixelsPerSecond,
  calculateVisibleTimeRange,
  formatTime,
  formatTimeWithAutoPrecision,
  alignTimeToFrame
} from '../stores/utils/storeUtils'
```

### 使用示例
```typescript
// 计算每秒像素数
const pixelsPerSecond = calculatePixelsPerSecond(800, 60, 1.5)

// 计算可见时间范围
const { startTime, endTime } = calculateVisibleTimeRange(800, 60, 1.5, 100)

// 格式化时间
const timeStr = formatTime(125.5, 'milliseconds') // "02:05.50"

// 自动精度格式化
const autoTimeStr = formatTimeWithAutoPrecision(125.5, pixelsPerSecond, 30)
```

## ✅ 验证结果

- ✅ 所有文件编译通过，无 TypeScript 错误
- ✅ 功能逻辑保持一致
- ✅ 代码重复度显著降低
- ✅ 维护性大幅提升

## 🚀 后续建议

1. **扩展应用**: 检查其他可能使用类似逻辑的组件
2. **性能监控**: 监控重构后的性能表现
3. **单元测试**: 为新的工具函数添加单元测试
4. **文档完善**: 继续完善工具函数的使用文档
