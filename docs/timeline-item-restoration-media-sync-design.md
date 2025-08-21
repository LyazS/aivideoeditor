# 时间轴项目恢复时的媒体同步设计方案

## 问题概述

在实现时间轴项目恢复逻辑时，我们使用了 `setupCommandMediaSync` 来为 loading 状态的时间轴项目设置媒体同步。然而，`setupCommandMediaSync` 是专门为命令操作设计的，不适用于项目加载场景。我们需要创建一个完全独立的、专门为项目加载时使用的媒体同步机制。

## 当前问题分析

### setupCommandMediaSync 的设计目的
- 专为命令操作设计，如 AddTimelineItemCommand
- 依赖命令ID和命令实例
- 包含命令生命周期管理（dispose、cleanup）
- 期望命令实例存在 updateMediaData 方法

### 项目加载场景的特点
- 不是命令操作，而是项目恢复过程
- 没有命令ID和命令实例
- 需要直接监听媒体项目状态变化
- 需要直接更新时间轴项目的运行时内容

## 设计方案

### 1. 创建独立的项目加载媒体同步工具

我们将创建一个全新的工具函数 `setupProjectLoadMediaSync` 和相关的管理类，完全独立于现有的命令媒体同步系统。

#### 核心工具函数
```typescript
/**
 * 设置项目加载时的媒体同步
 * @param mediaItemId 媒体项目ID
 * @param timelineItemId 时间轴项目ID
 * @param description 描述信息（用于日志）
 * @returns 取消监听的函数
 */
export function setupProjectLoadMediaSync(
  mediaItemId: string,
  timelineItemId: string,
  description?: string,
): () => void
```

#### 媒体同步管理器（全新设计）
```typescript
/**
 * 项目加载媒体同步管理器
 * 完全独立于 SimplifiedMediaSyncManager
 */
export class ProjectLoadMediaSyncManager {
  private static instance: ProjectLoadMediaSyncManager
  private syncMap = new Map<string, {
    mediaItemId: string
    timelineItemId: string
    unwatch: () => void
    description?: string
  }>()
  
  private constructor() {}
  
  static getInstance(): ProjectLoadMediaSyncManager {
    if (!ProjectLoadMediaSyncManager.instance) {
      ProjectLoadMediaSyncManager.instance = new ProjectLoadMediaSyncManager()
    }
    return ProjectLoadMediaSyncManager.instance
  }
  
  /**
   * 注册媒体同步
   */
  register(
    timelineItemId: string,
    mediaItemId: string,
    unwatch: () => void,
    description?: string,
  ): void {
    // 清理已存在的同步（避免重复）
    this.cleanup(timelineItemId)
    
    this.syncMap.set(timelineItemId, {
      mediaItemId,
      timelineItemId,
      unwatch,
      description,
    })
  }
  
  /**
   * 清理指定的媒体同步
   */
  cleanup(timelineItemId: string): void {
    const sync = this.syncMap.get(timelineItemId)
    if (sync) {
      sync.unwatch()
      this.syncMap.delete(timelineItemId)
    }
  }
  
  /**
   * 清理所有媒体同步
   */
  cleanupAll(): void {
    for (const [timelineItemId, sync] of this.syncMap) {
      sync.unwatch()
    }
    this.syncMap.clear()
  }
  
  /**
   * 获取同步信息（用于调试）
   */
  getSyncInfo(): Array<{
    timelineItemId: string
    mediaItemId: string
    description?: string
  }> {
    return Array.from(this.syncMap.values()).map(sync => ({
      timelineItemId: sync.timelineItemId,
      mediaItemId: sync.mediaItemId,
      description: sync.description,
    }))
  }
}
```

### 2. 时间轴项目状态转换函数

创建一个专门用于时间轴项目状态转换的函数，当媒体项目 ready 时调用。

#### 函数签名
```typescript
/**
 * 将时间轴项目转换为 ready 状态
 * @param timelineItemId 时间轴项目ID
 * @param mediaItem 媒体项目
 * @param description 描述信息（用于日志）
 */
async function transitionTimelineItemToReady(
  timelineItemId: string,
  mediaItem: UnifiedMediaItemData,
  description?: string,
): Promise<void>
```

## 具体实现步骤

### 1. 创建项目加载媒体同步工具

在 `@/unified/composables/useProjectLoadMediaSync.ts` 中创建全新的工具：

```typescript
import { watch } from 'vue'
import type { UnifiedMediaItemData } from '@/unified/mediaitem/types'
import { UnifiedMediaItemQueries } from '@/unified/mediaitem'
import { useUnifiedStore } from '@/unified/unifiedStore'
import { createSpriteFromUnifiedMediaItem } from '@/unified/utils/spriteFactory'
import { regenerateThumbnailForUnifiedTimelineItem } from '@/unified/utils/thumbnailGenerator'

/**
 * 项目加载媒体同步管理器
 */
export class ProjectLoadMediaSyncManager {
  private static instance: ProjectLoadMediaSyncManager
  private syncMap = new Map<string, {
    mediaItemId: string
    timelineItemId: string
    unwatch: () => void
    description?: string
  }>()
  
  private constructor() {}
  
  static getInstance(): ProjectLoadMediaSyncManager {
    if (!ProjectLoadMediaSyncManager.instance) {
      ProjectLoadMediaSyncManager.instance = new ProjectLoadMediaSyncManager()
    }
    return ProjectLoadMediaSyncManager.instance
  }
  
  /**
   * 注册媒体同步
   */
  register(
    timelineItemId: string,
    mediaItemId: string,
    unwatch: () => void,
    description?: string,
  ): void {
    // 清理已存在的同步（避免重复）
    this.cleanup(timelineItemId)
    
    this.syncMap.set(timelineItemId, {
      mediaItemId,
      timelineItemId,
      unwatch,
      description,
    })
  }
  
  /**
   * 清理指定的媒体同步
   */
  cleanup(timelineItemId: string): void {
    const sync = this.syncMap.get(timelineItemId)
    if (sync) {
      sync.unwatch()
      this.syncMap.delete(timelineItemId)
    }
  }
  
  /**
   * 清理所有媒体同步
   */
  cleanupAll(): void {
    for (const [timelineItemId, sync] of this.syncMap) {
      sync.unwatch()
    }
    this.syncMap.clear()
  }
  
  /**
   * 获取同步信息（用于调试）
   */
  getSyncInfo(): Array<{
    timelineItemId: string
    mediaItemId: string
    description?: string
  }> {
    return Array.from(this.syncMap.values()).map(sync => ({
      timelineItemId: sync.timelineItemId,
      mediaItemId: sync.mediaItemId,
      description: sync.description,
    }))
  }
}

/**
 * 设置项目加载时的媒体同步
 */
export function setupProjectLoadMediaSync(
  mediaItemId: string,
  timelineItemId: string,
  description?: string,
): () => void {
  const unifiedStore = useUnifiedStore()
  const syncManager = ProjectLoadMediaSyncManager.getInstance()
  
  // 获取媒体项目
  const mediaItem = unifiedStore.getMediaItem(mediaItemId)
  if (!mediaItem) {
    console.error(`❌ [ProjectLoadMediaSync] 找不到媒体项目: ${mediaItemId}`)
    return () => {} // 返回空函数
  }
  
  // 检查媒体项目状态，只有非ready状态才需要设置同步
  const isReady = UnifiedMediaItemQueries.isReady(mediaItem)
  
  if (isReady) {
    console.log(`⏭️ [ProjectLoadMediaSync] 跳过同步设置，媒体项目已经ready: ${mediaItem.name}`, {
      timelineItemId,
      mediaItemId: mediaItem.id,
    })
    // 如果媒体已经ready，直接转换时间轴项目状态
    transitionTimelineItemToReady(timelineItemId, mediaItem, description)
    return () => {} // 返回空函数
  }
  
  const unwatch = watch(
    () => mediaItem.mediaStatus,
    async (newStatus, oldStatus) => {
      console.log(`🔄 [ProjectLoadMediaSync] 媒体状态变化: ${description}`, {
        mediaItemId,
        mediaName: mediaItem.name,
        statusChange: `${oldStatus} → ${newStatus}`,
      })
      
      let shouldCleanup = false
      
      // 只在状态变为ready时更新时间轴项目
      if (newStatus === 'ready') {
        await transitionTimelineItemToReady(timelineItemId, mediaItem, description)
        // ready是终态，标记为需要清理
        shouldCleanup = true
      } else if (newStatus === 'error' || newStatus === 'cancelled' || newStatus === 'missing') {
        // 媒体状态变为错误、取消或缺失时，更新对应的时间轴项目状态
        const timelineItem = unifiedStore.getTimelineItem(timelineItemId)
        if (timelineItem) {
          timelineItem.timelineStatus = 'error'
          console.log(`❌ [ProjectLoadMediaSync] 时间轴项目状态已设置为错误: ${timelineItemId}`, {
            mediaItemId,
            mediaName: mediaItem.name,
            mediaStatus: newStatus,
          })
        }
        // 错误状态是终态，标记为需要清理
        shouldCleanup = true
      }
      
      // 如果达到终态，自动清理监听器
      if (shouldCleanup) {
        console.log(
          `🧹 [ProjectLoadMediaSync] 媒体达到终态(${newStatus})，自动清理监听器: ${description} <-> ${mediaItemId}`,
        )
        
        // 从ProjectLoadMediaSyncManager中移除
        syncManager.cleanup(timelineItemId)
        
        console.log(`✅ [ProjectLoadMediaSync] 监听器清理完成: ${description} <-> ${mediaItemId}`)
      }
    },
    { immediate: true },
  )
  
  // 注册到ProjectLoadMediaSyncManager中
  syncManager.register(timelineItemId, mediaItemId, unwatch, description)
  
  console.log(
    `💾 [ProjectLoadMediaSync] 已注册监听器到项目加载媒体同步管理器: ${description} <-> ${mediaItemId}`,
  )
  
  // 返回取消监听的函数
  return () => {
    console.log(`🧹 [ProjectLoadMediaSync] 手动取消监听: ${description} <-> ${mediaItemId}`)
    syncManager.cleanup(timelineItemId)
  }
}

/**
 * 将时间轴项目转换为 ready 状态
 */
async function transitionTimelineItemToReady(
  timelineItemId: string,
  mediaItem: UnifiedMediaItemData,
  description?: string,
): Promise<void> {
  try {
    console.log(`🎨 [ProjectLoadMediaSync] 开始转换时间轴项目状态: ${timelineItemId}`, {
      mediaItemId: mediaItem.id,
      mediaType: mediaItem.mediaType,
    })
    
    const unifiedStore = useUnifiedStore()
    
    // 获取时间轴项目
    const timelineItem = unifiedStore.getTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.log(`⚠️ [ProjectLoadMediaSync] 找不到时间轴项目: ${timelineItemId}，跳过状态转换`)
      return
    }
    
    // 检查时间轴项目状态，只有loading状态才需要处理
    if (timelineItem.timelineStatus !== 'loading') {
      console.log(
        `⏭️ [ProjectLoadMediaSync] 跳过状态转换，时间轴项目状态不是loading: ${timelineItemId}`,
        {
          currentStatus: timelineItem.timelineStatus,
        },
      )
      return
    }
    
    // 1. 创建Sprite
    try {
      console.log(`🔄 [ProjectLoadMediaSync] 为时间轴项目创建Sprite: ${timelineItemId}`)
      const sprite = await createSpriteFromUnifiedMediaItem(mediaItem)
      
      // 将sprite存储到runtime中，并更新sprite时间
      timelineItem.runtime.sprite = sprite
      timelineItem.runtime.sprite.setTimeRange({ ...timelineItem.timeRange })
      await unifiedStore.addSpriteToCanvas(timelineItem.runtime.sprite)
      console.log(`✅ [ProjectLoadMediaSync] Sprite创建成功并存储到runtime: ${timelineItemId}`)
      
      // 2. 将时间轴项目的配置应用到sprite中
      await applyTimelineItemConfigToSprite(timelineItem)
    } catch (spriteError) {
      console.error(`❌ [ProjectLoadMediaSync] 创建Sprite失败: ${timelineItemId}`, spriteError)
      // Sprite创建失败不影响后续操作
    }
    
    // 3. 生成缩略图（仅对视频和图片类型）
    if (UnifiedMediaItemQueries.isVisualMedia(mediaItem)) {
      try {
        console.log(`🖼️ [ProjectLoadMediaSync] 为时间轴项目生成缩略图: ${timelineItemId}`)
        const thumbnailUrl = await regenerateThumbnailForUnifiedTimelineItem(
          timelineItem,
          mediaItem,
        )
        
        if (thumbnailUrl) {
          timelineItem.runtime.thumbnailUrl = thumbnailUrl
          console.log(`✅ [ProjectLoadMediaSync] 缩略图生成成功: ${timelineItemId}`, {
            thumbnailUrl: thumbnailUrl.substring(0, 50) + '...',
          })
        } else {
          console.log(`⚠️ [ProjectLoadMediaSync] 缩略图生成返回空结果: ${timelineItemId}`)
        }
      } catch (thumbnailError) {
        console.error(`❌ [ProjectLoadMediaSync] 生成缩略图失败: ${timelineItemId}`, thumbnailError)
        // 缩略图生成失败不影响后续操作
      }
    } else {
      console.log(
        `🎵 [ProjectLoadMediaSync] ${mediaItem.mediaType}类型不需要生成缩略图: ${timelineItemId}`,
      )
    }
    
    // 4. 更新时间轴项目状态
    timelineItem.timelineStatus = 'ready'
    
    console.log(`🎉 [ProjectLoadMediaSync] 时间轴项目状态转换完成: ${timelineItemId}`)
  } catch (error) {
    console.error(`❌ [ProjectLoadMediaSync] 转换时间轴项目状态失败: ${timelineItemId}`, {
      mediaItemId: mediaItem.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * 将时间轴项目的配置应用到sprite中
 * @param timelineItem 时间轴项目
 */
async function applyTimelineItemConfigToSprite(
  timelineItem: UnifiedTimelineItemData<any>,
): Promise<void> {
  try {
    // 检查sprite是否存在
    if (!timelineItem.runtime?.sprite) {
      console.warn(`⚠️ [ProjectLoadMediaSync] Sprite不存在，无法应用配置: ${timelineItem.id}`)
      return
    }
    
    const sprite = timelineItem.runtime.sprite
    const config = timelineItem.config
    
    console.log(`🎨 [ProjectLoadMediaSync] 将时间轴项目配置应用到sprite: ${timelineItem.id}`, {
      mediaType: timelineItem.mediaType,
      hasAnimation: !!(timelineItem.animation && timelineItem.animation.isEnabled && timelineItem.animation.keyframes.length > 0),
    })
    
    // 设置sprite的基本属性
    // 注意：位置属性需要使用坐标转换系统，将项目坐标转换为WebAV坐标
    if (config.width !== undefined) sprite.width = config.width
    if (config.height !== undefined) sprite.height = config.height
    if (config.rotation !== undefined) sprite.rotation = config.rotation
    if (config.opacity !== undefined) sprite.opacity = config.opacity
    if (config.zIndex !== undefined) sprite.zIndex = config.zIndex
    
    // 对于有音频属性的类型
    if (timelineItem.mediaType === 'video' || timelineItem.mediaType === 'audio') {
      if (config.volume !== undefined) sprite.volume = config.volume
      if (config.isMuted !== undefined) sprite.isMuted = config.isMuted
    }
    
    // 使用坐标转换系统设置位置属性
    if (config.x !== undefined || config.y !== undefined) {
      try {
        // 导入坐标转换工具
        const { projectToWebavCoords } = await import('@/unified/utils/coordinateTransform')
        const { useUnifiedStore } = await import('@/unified/unifiedStore')
        const unifiedStore = useUnifiedStore()
        
        // 获取当前配置值，如果未定义则使用sprite的当前值
        const x = config.x !== undefined ? config.x : sprite.x
        const y = config.y !== undefined ? config.y : sprite.y
        const width = config.width !== undefined ? config.width : sprite.width
        const height = config.height !== undefined ? config.height : sprite.height
        
        // 使用坐标转换系统将项目坐标转换为WebAV坐标
        const webavCoords = projectToWebavCoords(
          x,
          y,
          width,
          height,
          unifiedStore.videoResolution.width,
          unifiedStore.videoResolution.height,
        )
        
        // 设置转换后的坐标
        sprite.rect.x = webavCoords.x
        sprite.rect.y = webavCoords.y
        
        console.log(`🎯 [ProjectLoadMediaSync] 已使用坐标转换系统设置位置: ${timelineItem.id}`, {
          projectCoords: { x, y },
          webavCoords: { x: webavCoords.x, y: webavCoords.y },
          size: { width, height },
          canvasSize: {
            width: unifiedStore.videoResolution.width,
            height: unifiedStore.videoResolution.height,
          },
        })
      } catch (coordError) {
        console.error(`❌ [ProjectLoadMediaSync] 坐标转换失败: ${timelineItem.id}`, coordError)
        // 坐标转换失败时，尝试直接设置
        if (config.x !== undefined) sprite.x = config.x
        if (config.y !== undefined) sprite.y = config.y
      }
    }
    
    console.log(`✅ [ProjectLoadMediaSync] 基本配置已应用到sprite: ${timelineItem.id}`, {
      width: sprite.width,
      height: sprite.height,
      rotation: sprite.rotation,
      opacity: sprite.opacity,
      zIndex: sprite.zIndex,
      volume: sprite.volume,
      isMuted: sprite.isMuted,
      webavCoords: {
        x: sprite.rect.x,
        y: sprite.rect.y,
      },
    })
    
    // 应用动画配置到sprite（如果有）
    if (timelineItem.animation && timelineItem.animation.isEnabled && timelineItem.animation.keyframes.length > 0) {
      try {
        console.log(`🎬 [ProjectLoadMediaSync] 应用动画配置到sprite: ${timelineItem.id}`, {
          keyframeCount: timelineItem.animation.keyframes.length,
          isEnabled: timelineItem.animation.isEnabled,
        })
        
        // 使用WebAVAnimationManager来应用动画
        const { updateWebAVAnimation } = await import('@/unified/utils/webavAnimationManager')
        await updateWebAVAnimation(timelineItem)
        
        console.log(`✅ [ProjectLoadMediaSync] 动画配置应用成功: ${timelineItem.id}`)
      } catch (animationError) {
        console.error(`❌ [ProjectLoadMediaSync] 应用动画配置失败: ${timelineItem.id}`, animationError)
        // 动画应用失败不影响后续操作
      }
    }
  } catch (error) {
    console.error(`❌ [ProjectLoadMediaSync] 应用时间轴项目配置到sprite失败: ${timelineItem.id}`, {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * 清理项目加载媒体同步
 * @param timelineItemId 时间轴项目ID（可选，不提供则清理所有）
 */
export function cleanupProjectLoadMediaSync(timelineItemId?: string): void {
  const syncManager = ProjectLoadMediaSyncManager.getInstance()
  
  if (timelineItemId) {
    syncManager.cleanup(timelineItemId)
    console.log(`🗑️ [ProjectLoadMediaSync] 已清理指定时间轴项目的媒体同步: ${timelineItemId}`)
  } else {
    syncManager.cleanupAll()
    console.log(`🗑️ [ProjectLoadMediaSync] 已清理所有项目加载媒体同步`)
  }
}

/**
 * 获取项目加载媒体同步信息（用于调试）
 */
export function getProjectLoadMediaSyncInfo(): Array<{
  timelineItemId: string
  mediaItemId: string
  description?: string
}> {
  const syncManager = ProjectLoadMediaSyncManager.getInstance()
  return syncManager.getSyncInfo()
}
```

### 2. 修改 restoreTimelineItems 方法

在 `UnifiedProjectModule.ts` 中修改 `restoreTimelineItems` 方法，使用新的项目加载媒体同步：

```typescript
import { setupProjectLoadMediaSync } from '@/unified/composables/useProjectLoadMediaSync'

async function restoreTimelineItems(): Promise<void> {
  // ... 前面的代码保持不变 ...
  
  // 3. 针对loading状态的项目设置状态同步
  if (newTimelineItem.timelineStatus === 'loading') {
    setupProjectLoadMediaSync(
      newTimelineItem.mediaItemId,
      newTimelineItem.id,
      `restoreTimelineItems ${newTimelineItem.id}`,
    )
  }
  
  // ... 后面的代码保持不变 ...
}
```

### 3. 在项目模块中添加清理逻辑

在 `UnifiedProjectModule.ts` 中添加清理方法，确保在项目切换或卸载时清理所有监听器：

```typescript
/**
 * 清理项目加载时的媒体同步
 */
function cleanupProjectMediaSync(): void {
  cleanupProjectLoadMediaSync()
}

// 在导出接口中添加
return {
  // ... 现有导出 ...
  cleanupProjectMediaSync,
}
```

## 预期效果

实施此方案后，项目加载时的媒体同步将具有以下特点：

1. **完全独立**：不依赖现有的命令媒体同步系统，完全独立运行
2. **专用性**：专门为项目加载场景设计，不涉及命令系统
3. **简洁性**：直接监听媒体项目状态变化，直接更新时间轴项目
4. **可靠性**：正确处理各种媒体状态变化，包括 ready、error、cancelled、missing
5. **可维护性**：职责清晰，与命令媒体同步完全分离

## 注意事项

1. **清理机制**：确保在项目切换或卸载时清理所有监听器
2. **错误处理**：妥善处理媒体项目或时间轴项目不存在的情况
3. **性能考虑**：避免重复设置同步，检查媒体项目当前状态
4. **日志记录**：提供清晰的日志信息，便于问题排查
5. **内存管理**：确保所有监听器都能正确清理，避免内存泄漏