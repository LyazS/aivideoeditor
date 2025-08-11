# 支持未ready素材拖拽到时间轴方案

## 概述

当前系统要求素材必须完全解析完成（ready状态）才能拖拽到时间轴。本方案旨在支持未ready的素材（如正在远程下载的文件）也能被拖拽到时间轴，提供更流畅的用户体验。

## 当前状态分析

### 现有限制

在 `UnifiedTimeline.vue` 的 `createMediaClipFromMediaItem` 函数中存在以下检查：

```typescript
// 第1471-1473行
if (!UnifiedMediaItemQueries.isReady(storeMediaItem)) {
  throw new Error('素材还在解析中，请稍后再试')
}
```

这个检查阻止了未ready素材的拖拽操作。

### 已有基础设施

系统已经具备支持loading状态的基础设施：

1. **时间轴项目状态管理**
   - `timelineStatus` 字段支持 `loading`、`ready`、`error` 三种状态
   - 状态转换机制：`VALID_TIMELINE_TRANSITIONS`
   - 媒体状态到时间轴状态的映射：`MEDIA_TO_TIMELINE_STATUS_MAP`

2. **Loading状态渲染**
   - `LoadingContentRenderer` 专门处理loading状态的渲染
   - 支持进度条显示：`renderProgressBar` 方法
   - 支持状态指示器：`renderStatusIndicator` 方法
   - CSS样式：`.status-loading` 包含虚线边框和脉冲动画

3. **素材状态管理**
   - 多种素材状态：`pending`、`asyncprocessing`、`webavdecoding`、`ready`、`error`等
   - 状态转换验证：`UnifiedMediaItemQueries.canTransitionTo`
   - 进度跟踪：`UnifiedMediaItemQueries.getProgress`

## 核心约束条件

### 拖拽到时间轴的必要条件

基于时间轴的工作原理，素材要能被拖拽到时间轴必须满足以下条件：

1. **已知媒体类型**: 用于确定可以拖拽到哪种轨道（video/audio/text轨道）
2. **已知时长**: 用于在时间轴上正确显示项目长度和时间范围

### 各状态下的条件满足情况

| 素材状态 | 媒体类型 | 时长信息 | 可拖拽性 |
|---------|---------|---------|---------|
| pending | unknown | 无或用户预输入 | ❌ 不可拖拽 |
| asyncprocessing | 可能unknown | 可能有服务器元数据 | ⚠️ 条件满足时可拖拽 |
| webavdecoding | 通常已确定 | 可能已有初步信息 | ⚠️ 条件满足时可拖拽 |
| ready | 已确定 | 准确信息 | ✅ 完全可拖拽 |

### 实际支持的场景

1. **远程文件下载场景**:
   - 服务器HTTP响应提供Content-Type（确定媒体类型）
   - 服务器HTTP响应提供Content-Length或Duration元数据（确定时长）
   - 此时虽然文件还在下载，但已具备拖拽条件

2. **本地文件解析场景**:
   - 文件扩展名或MIME类型已确定媒体类型
   - WebAV开始解析后可能很快获得时长信息
   - 在WebAV完全解析完成前就可以拖拽

## 方案设计

### 核心思路

在满足媒体类型和时长已知的前提下，允许未ready的素材被拖拽到时间轴，创建处于loading状态的时间轴项目，然后通过状态同步机制自动转换为ready状态。

### 实现步骤

#### 1. 修改拖拽检查逻辑

**目标文件**: `frontend/src/unified/components/UnifiedTimeline.vue`

**修改位置**: `createMediaClipFromMediaItem` 函数（约第1471行）

**修改内容**:
```typescript
// 移除原有的ready状态检查
// if (!UnifiedMediaItemQueries.isReady(storeMediaItem)) {
//   throw new Error('素材还在解析中，请稍后再试')
// }

// 替换为状态判断逻辑
const isReady = UnifiedMediaItemQueries.isReady(storeMediaItem)
const hasError = UnifiedMediaItemQueries.hasError(storeMediaItem)

// 只阻止错误状态的素材
if (hasError) {
  throw new Error('素材解析失败，无法添加到时间轴')
}

// 根据素材状态确定时间轴项目状态
const timelineStatus: TimelineItemStatus = isReady ? 'ready' : 'loading'
```

#### 2. 核心约束条件分析

**必需条件**: 素材必须具备已知的媒体类型和时长才能被拖拽到时间轴

**媒体类型获取时机**:
- **pending状态**: `mediaType: 'unknown'` - 还未检测，不能拖拽
- **asyncprocessing状态**: 可能仍为 `'unknown'`，取决于数据源类型检测时机
- **webavdecoding状态**: 通常已确定具体类型（video/image/audio）
- **ready状态**: 必定有确定的媒体类型

**时长获取时机**:
- **pending状态**: `duration: undefined` 或用户预输入值
- **asyncprocessing状态**: 可能有服务器提供的元数据或用户预输入值
- **webavdecoding状态**: 通常仍在解析中，时长可能未确定
- **ready状态**: 必定有准确的时长信息

#### 3. 修订后的拖拽条件检查

**解决方案**: 检查媒体类型和时长的可用性，而不仅仅是ready状态

```typescript
// 在 createMediaClipFromMediaItem 函数中
const isReady = UnifiedMediaItemQueries.isReady(storeMediaItem)
const hasError = UnifiedMediaItemQueries.hasError(storeMediaItem)

// 检查是否有错误
if (hasError) {
  throw new Error('素材解析失败，无法添加到时间轴')
}

// 检查媒体类型是否已知
if (storeMediaItem.mediaType === 'unknown') {
  throw new Error('素材类型未确定，请等待检测完成')
}

// 检查是否有可用的时长信息
const availableDuration = storeMediaItem.duration
if (!availableDuration || availableDuration <= 0) {
  throw new Error('素材时长信息不可用，请等待解析完成')
}

// 根据素材状态确定时间轴项目状态
const timelineStatus: TimelineItemStatus = isReady ? 'ready' : 'loading'

// 使用可用的时长信息
const timelineItemData: UnifiedTimelineItemData = {
  id: generateId(),
  mediaItemId: storeMediaItem.id,
  trackId: trackId,
  mediaType: storeMediaItem.mediaType, // 已确定的类型
  timeRange: {
    timelineStartTime: startTimeFrames,
    timelineEndTime: startTimeFrames + availableDuration, // 使用实际时长
    clipStartTime: 0,
    clipEndTime: availableDuration,
  },
  config: config,
  animation: undefined,
  timelineStatus: timelineStatus, // loading或ready
  runtime: {},
}
```

#### 4. 实际可拖拽的状态分析

基于上述约束条件，实际可以支持拖拽的素材状态包括：

1. **asyncprocessing状态** + 已知媒体类型 + 有时长信息
   - 远程文件下载时，服务器提供了Content-Type和Content-Length
   - 用户手动输入了媒体类型和预期时长

2. **webavdecoding状态** + 已知媒体类型 + 有时长信息
   - 文件已下载完成，正在WebAV解析
   - 媒体类型已通过文件扩展名或MIME类型确定
   - 可能已有初步的时长信息

3. **ready状态** (当前已支持)
   - 完全解析完成，所有信息都可用

#### 5. 添加状态同步机制

**新增模块**: `frontend/src/unified/composables/useTimelineMediaSync.ts`

**功能**: 监听素材状态变化，自动同步时间轴项目状态

```typescript
/**
 * 时间轴素材状态同步组合函数
 */
export function useTimelineMediaSync() {
  const unifiedStore = useUnifiedStore()
  
  /**
   * 为时间轴项目设置素材状态监听
   */
  function setupMediaSync(timelineItemId: string, mediaItemId: string) {
    const mediaItem = unifiedStore.getMediaItem(mediaItemId)
    const timelineItem = unifiedStore.getTimelineItem(timelineItemId)
    
    if (!mediaItem || !timelineItem) {
      console.warn('无法设置状态同步：找不到对应的项目')
      return
    }
    
    // 监听素材状态变化
    const unwatch = watch(
      () => mediaItem.mediaStatus,
      async (newStatus, oldStatus) => {
        await handleMediaStatusChange(timelineItem, mediaItem, newStatus, oldStatus)
      },
      { immediate: false }
    )
    
    // 返回清理函数
    return unwatch
  }
  
  /**
   * 处理素材状态变化
   */
  async function handleMediaStatusChange(
    timelineItem: UnifiedTimelineItemData,
    mediaItem: UnifiedMediaItemData,
    newStatus: MediaStatus,
    oldStatus: MediaStatus
  ) {
    console.log(`🔄 素材状态变化: ${mediaItem.name} ${oldStatus} → ${newStatus}`)
    
    if (newStatus === 'ready' && timelineItem.timelineStatus === 'loading') {
      // 素材ready了，转换时间轴项目状态
      await transitionToReady(timelineItem, mediaItem)
    } else if (['error', 'cancelled', 'missing'].includes(newStatus)) {
      // 素材出错了，标记时间轴项目为错误
      if (timelineItem.timelineStatus === 'loading') {
        timelineItem.timelineStatus = 'error'
        console.log(`❌ 时间轴项目转为错误状态: ${timelineItem.id}`)
      }
    }
  }
  
  /**
   * 将loading状态的时间轴项目转换为ready状态
   */
  async function transitionToReady(
    timelineItem: UnifiedTimelineItemData,
    mediaItem: UnifiedMediaItemData
  ) {
    try {
      console.log(`✅ 转换时间轴项目为ready状态: ${timelineItem.id}`)
      
      // 更新时长（如果有变化）
      const actualDuration = mediaItem.duration
      const currentDuration = timelineItem.timeRange.timelineEndTime - timelineItem.timeRange.timelineStartTime
      
      if (actualDuration !== currentDuration) {
        // 调整时间轴项目的结束时间
        timelineItem.timeRange.timelineEndTime = timelineItem.timeRange.timelineStartTime + actualDuration
        timelineItem.timeRange.clipEndTime = actualDuration
        console.log(`📏 调整时间轴项目时长: ${currentDuration} → ${actualDuration}`)
      }
      
      // 更新媒体类型（如果从unknown变为具体类型）
      if (timelineItem.mediaType === 'unknown' && mediaItem.mediaType !== 'unknown') {
        timelineItem.mediaType = mediaItem.mediaType
        console.log(`🎭 更新媒体类型: unknown → ${mediaItem.mediaType}`)
      }
      
      // 转换状态为ready
      timelineItem.timelineStatus = 'ready'
      
      // 创建WebAV sprite等运行时对象
      await createRuntimeObjects(timelineItem, mediaItem)
      
    } catch (error) {
      console.error('❌ 转换时间轴项目状态失败:', error)
      timelineItem.timelineStatus = 'error'
    }
  }
  
  return {
    setupMediaSync,
    handleMediaStatusChange,
    transitionToReady
  }
}
```

#### 6. 集成状态同步到时间轴项目创建流程

**修改位置**: `createMediaClipFromMediaItem` 函数末尾

```typescript
// 在添加时间轴项目到store之后
await unifiedStore.addTimelineItemWithHistory(timelineItemData)

// 如果是loading状态，设置状态同步
if (timelineStatus === 'loading') {
  const { setupMediaSync } = useTimelineMediaSync()
  setupMediaSync(timelineItemData.id, storeMediaItem.id)
}

console.log(`✅ [UnifiedTimeline] 时间轴项目创建完成: ${timelineItemData.id}`)
```

## 用户体验优化

### 1. 拖拽预览增强

在拖拽过程中显示素材的当前状态：

```typescript
// 在 handleMediaItemDragOver 函数中
const mediaDragData = dragUtils.getCurrentMediaItemDragData()
if (mediaDragData) {
  const mediaItem = unifiedStore.getMediaItem(mediaDragData.mediaItemId)
  const isReady = mediaItem ? UnifiedMediaItemQueries.isReady(mediaItem) : false
  const isLoading = mediaItem ? UnifiedMediaItemQueries.isProcessing(mediaItem) : false
  
  // 在预览数据中包含状态信息
  const previewData = dragUtils.createDragPreviewData(
    mediaDragData.name,
    mediaDragData.duration,
    dropTime,
    targetTrackId,
    isConflict,
    false,
    undefined,
    mediaDragData.mediaType,
    { isReady, isLoading } // 新增状态信息
  )
}
```

### 2. Loading状态渲染增强

**目标文件**: `frontend/src/unified/components/renderers/status/LoadingContentRenderer.ts`

**增强内容**:
- 显示实时下载进度和速度
- 提供取消下载按钮
- 显示更详细的状态信息

### 3. 错误处理和重试机制

为错误状态的时间轴项目提供：
- 错误原因显示
- 重试下载按钮
- 移除项目选项

## 技术考虑

### 1. 性能优化

- **监听器管理**: 及时清理不需要的状态监听器
- **批量更新**: 对于大量loading项目，使用批量状态更新
- **内存管理**: 避免内存泄漏，特别是长时间运行的监听器

### 2. 状态一致性

- **原子操作**: 确保状态转换的原子性
- **错误恢复**: 处理状态转换过程中的异常情况
- **数据同步**: 保持时间轴项目与素材项目的数据一致性

### 3. 用户反馈

- **进度指示**: 清晰的进度条和百分比显示
- **状态说明**: 用户友好的状态描述文本
- **操作提示**: 引导用户了解loading状态的含义

## 实施计划

### 阶段1: 基础功能实现
1. 修改拖拽检查逻辑
2. 实现基础的loading状态时间轴项目创建
3. 添加简单的状态同步机制

### 阶段2: 用户体验优化
1. 增强loading状态的视觉反馈
2. 添加进度显示和取消功能
3. 完善错误处理机制

### 阶段3: 性能和稳定性
1. 优化状态监听器的性能
2. 添加全面的错误恢复机制
3. 进行压力测试和稳定性验证

## 总结

本方案在满足**媒体类型和时长已知**这一核心约束的前提下，通过利用现有的loading状态基础设施，实现了对未ready素材的拖拽支持。

### 关键特点

1. **有条件支持**: 不是所有未ready素材都能拖拽，必须满足媒体类型和时长已知的条件
2. **渐进式体验**: 在条件满足的情况下，用户可以在素材完全解析完成前开始编辑
3. **自动同步**: 通过状态监听机制，时间轴项目会自动跟随素材状态变化
4. **向后兼容**: 对现有ready素材的拖拽行为无影响

### 实际效果

- **远程文件场景**: 当服务器提供足够的元数据时，用户可以在下载过程中就开始布局时间轴
- **本地文件场景**: 当文件类型和基本信息可快速确定时，用户无需等待完整的WebAV解析
- **用户体验**: 显著减少等待时间，提供更流畅的编辑工作流

这种设计在保证时间轴功能正确性的同时，最大化地提升了用户体验。
