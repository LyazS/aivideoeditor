# 轨道自动排列功能实现

## 功能概述

实现了每个轨道单独的自动排列功能，用于自动整理单个轨道内的视频片段，消除重叠并按时间顺序排列。

## 实现的功能

### 1. 单个轨道自动排列
- 每个轨道都有独立的自动排列按钮
- 按钮始终显示，但在没有片段时会被禁用
- 有片段时可点击按钮自动整理该轨道内的所有片段

### 2. 移除整体自动排列
- 移除了ClipManagementToolbar中的整体自动排列按钮
- 保留了其他片段管理功能（裁剪、删除等）

## 技术实现

### 1. 核心函数 (`storeUtils.ts`)

```typescript
/**
 * 自动整理单个轨道的时间轴项目，按时间排序并消除重叠
 * @param timelineItems 时间轴项目数组的ref
 * @param trackId 要整理的轨道ID
 */
export function autoArrangeTrackItems(timelineItems: Ref<TimelineItem[]>, trackId: number)
```

### 2. Store方法 (`videoStore.ts`)

```typescript
autoArrangeTrackItems: (trackId: number) => autoArrangeTrackItems(timelineModule.timelineItems, trackId)
```

### 3. UI组件 (`Timeline.vue`)

- 在每个轨道的控制按钮区域添加自动排列按钮
- 按钮只在轨道有多个片段时显示
- 使用专用的CSS样式 `arrange-btn`

## 使用方法

1. 每个轨道都有自动排列按钮（排列图标）
2. 当轨道内没有片段时，按钮显示为禁用状态
3. 当轨道内有片段时，点击按钮会自动按时间顺序排列，从0秒开始依次排列，消除重叠

## 功能特点

- **独立性**: 每个轨道独立操作，不影响其他轨道
- **智能状态**: 按钮始终显示，但在没有片段时自动禁用
- **时间排序**: 按片段的时间轴开始时间排序
- **消除重叠**: 自动调整片段位置，确保无重叠
- **统一起点**: 所有片段从时间轴开始位置（0秒）依次排列
- **保持属性**: 保留片段的所有其他属性（大小、位置、旋转等）

## 文件修改列表

1. `frontend/src/stores/utils/storeUtils.ts` - 添加单轨道自动排列函数
2. `frontend/src/stores/videoStore.ts` - 添加store方法
3. `frontend/src/components/Timeline.vue` - 添加UI按钮和处理函数
4. `frontend/src/components/ClipManagementToolbar.vue` - 移除整体自动排列功能

## 样式说明

自动排列按钮使用了专用的CSS类：
- `.track-btn.arrange-btn` - 使用次要强调色
- `.track-btn.arrange-btn:disabled` - 禁用状态样式（灰色、半透明）
- 悬停效果与其他轨道按钮保持一致
- 图标使用排列线条图标，直观表示排列功能
