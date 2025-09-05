# ThumbnailScheduler 模块化重构方案

## 项目背景

当前 [`ThumbnailScheduler`](frontend/src/unified/managers/ThumbnailScheduler.ts:21) 是一个独立的类，采用单例模式。为了与项目的统一模块化架构保持一致，需要将其重构为类似 [`createUnifiedMediaModule`](frontend/src/unified/modules/UnifiedMediaModule.ts:70) 的模块化设计。

## 当前架构分析

### 现有结构
```typescript
// frontend/src/unified/managers/ThumbnailScheduler.ts
export class ThumbnailScheduler {
  private pendingRequests = new Map<string, Array<{framePosition: number, timestamp: number}>>()
  private throttledProcessor: () => void

  constructor() {
    this.throttledProcessor = throttle(() => this.processAllPendingRequests(), 333)
  }

  requestThumbnails(request: ThumbnailBatchRequest): void { /* ... */ }
  private async processAllPendingRequests(): Promise<void> { /* ... */ }
  private async processTimelineItemRequests(timelineItemId: string, requests: any[]): Promise<void> { /* ... */ }
  private async processBatch(timelineItem: UnifiedTimelineItemData, thumbnailLayout: ThumbnailLayoutItem[]): Promise<Map<number, string>> { /* ... */ }
  cancelTasks(timelineItemId: string): void { /* ... */ }
  cleanup(): void { /* ... */ }
}

export const thumbnailScheduler = new ThumbnailScheduler()
```

### 调用方式
在 [`VideoContent.vue`](frontend/src/unified/components/renderers/VideoContent.vue:39) 中：
```typescript
import { thumbnailScheduler } from '@/unified/managers/ThumbnailScheduler'

thumbnailScheduler.requestThumbnails({
  timelineItemId: props.data.id,
  thumbnailLayout: uncachedItems,
  timestamp: Date.now()
})
```

## 重构目标

### 1. 模块化设计
创建 [`createUnifiedThumbnailSchedulerModule`](frontend/src/unified/modules/UnifiedThumbnailSchedulerModule.ts) 工厂函数，返回模块实例。

### 2. 依赖注入
移除对 [`useUnifiedStore()`](frontend/src/unified/managers/ThumbnailScheduler.ts:97) 的直接依赖，改为通过参数注入。

### 3. 状态管理
将实例属性改为模块内部的 ref 状态。

### 4. 接口保持
保持现有方法的接口兼容性。

### 5. 功能整合
将以下功能整合到新模块中：
- [`unifiedStore.ts`](frontend/src/unified/unifiedStore.ts:1442) 中的缩略图缓存功能
- [`thumbnailCacheUtils.ts`](frontend/src/unified/utils/thumbnailCacheUtils.ts:11) 中的工具函数

## 详细设计方案

### 1. 新模块文件结构

**文件**: `frontend/src/unified/modules/UnifiedThumbnailSchedulerModule.ts`

```typescript
import { ref } from 'vue'
import { throttle } from 'lodash'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem/TimelineItemData'
import type { ThumbnailLayoutItem, ThumbnailBatchRequest } from '@/unified/types/thumbnail'
import {
  canvasToBlob,
  calculateThumbnailSize,
  createThumbnailCanvas,
} from '@/unified/utils/thumbnailGenerator'
import { framesToMicroseconds } from '@/unified/utils/timeUtils'
import { ThumbnailMode, THUMBNAIL_CONSTANTS } from '@/unified/constants/ThumbnailConstants'
import { UnifiedMediaItemQueries } from '@/unified/mediaitem/queries'
import { generateCacheKey } from '@/unified/utils/'

export function createUnifiedThumbnailSchedulerModule(dependencies: {
  timelineModule: {
    getTimelineItem: (id: string) => UnifiedTimelineItemData | undefined
  }
  mediaModule: {
    getMediaItem: (id: string) => any
  }
  configModule: {
    frameRate: { value: number }
  }
  // WebAV相关依赖，用于缩略图生成
}) {
  const { timelineModule, mediaModule } = dependencies
  
  // 状态定义
  const pendingRequests = ref(new Map<string, Array<{framePosition: number, timestamp: number}>>())
  
  // 缩略图缓存状态（从unifiedStore.ts迁移）
  const thumbnailCache = ref(new Map<string, CachedThumbnail>())
  
  // 节流处理器
  const throttledProcessor = throttle(
    () => processAllPendingRequests(),
    333,
    { leading: false, trailing: true }
  )

  // 核心方法实现（保持原有逻辑）
  async function requestThumbnails(request: ThumbnailBatchRequest): Promise<void> {
    // ... 实现逻辑
  }

  async function processAllPendingRequests(): Promise<void> {
    // ... 实现逻辑
  }

  async function processTimelineItemRequests(
    timelineItemId: string,
    requests: Array<{framePosition: number, timestamp: number}>
  ): Promise<void> {
    // ... 实现逻辑
  }

  async function processBatch(
    timelineItem: UnifiedTimelineItemData,
    thumbnailLayout: ThumbnailLayoutItem[],
  ): Promise<Map<number, string>> {
    // ... 实现逻辑
  }

  function cancelTasks(timelineItemId: string): void {
    pendingRequests.value.delete(timelineItemId)
  }

  function cleanup(): void {
    pendingRequests.value.clear()
  }

  // 缓存管理方法（从unifiedStore.ts迁移）
  function clearThumbnailCacheByTimelineItem(timelineItemId: string): number {
    let removedCount = 0
    
    for (const [key, cached] of thumbnailCache.value.entries()) {
      if (cached.timelineItemId === timelineItemId) {
        // 释放Blob URL资源
        if (cached.blobUrl.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(cached.blobUrl)
          } catch (error) {
            console.warn('释放Blob URL失败:', error)
          }
        }
        thumbnailCache.value.delete(key)
        removedCount++
      }
    }
    
    return removedCount
  }

  function cleanupThumbnailCache(maxSize: number = 1000): number {
    if (thumbnailCache.value.size <= maxSize) {
      return 0
    }
    
    // 按时间戳排序，保留最新的
    const entries = Array.from(thumbnailCache.value.entries())
      .sort(([, a], [, b]) => b.timestamp - a.timestamp) // 降序排序，最新的在前
    
    let removedCount = 0
    
    // 删除超出限制的最旧项
    for (let i = maxSize; i < entries.length; i++) {
      const [key, cached] = entries[i]
      
      // 释放Blob URL资源
      if (cached.blobUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(cached.blobUrl)
        } catch (error) {
          console.warn('释放Blob URL失败:', error)
        }
      }
      
      thumbnailCache.value.delete(key)
      removedCount++
    }
    
    return removedCount
  }

  function getCachedThumbnail(timelineItemId: string, frame: number): CachedThumbnail | undefined {
    const cacheKey = generateCacheKey(timelineItemId, frame)
    return thumbnailCache.value.get(cacheKey)
  }

  function cacheThumbnail(thumbnail: CachedThumbnail): void {
    const cacheKey = generateCacheKey(
      thumbnail.timelineItemId,
      thumbnail.framePosition,
      thumbnail.clipStartTime,
      thumbnail.clipEndTime
    )
    
    // 检查是否已存在相同key的缓存，如果存在则释放旧的Blob URL
    const existing = thumbnailCache.value.get(cacheKey)
    if (existing && existing.blobUrl.startsWith('blob:')) {
      URL.revokeObjectURL(existing.blobUrl)
    }
    
    thumbnailCache.value.set(cacheKey, thumbnail)
  }

  // 工具函数（从thumbnailCacheUtils.ts迁移）
  function generateCacheKey(
    timelineItemId: string,
    framePosition: number,
    clipStartTime: number,
    clipEndTime: number
  ): string {
    // 格式: ${timelineItemId}-${framePosition}-${clipStartTime}-${clipEndTime}
    return `${timelineItemId}-${framePosition}-${clipStartTime}-${clipEndTime}`
  }

  function getThumbnailUrl(
    timelineItemId: string,
    framePosition: number,
    clipStartTime: number,
    clipEndTime: number
  ): string | null {
    const cacheKey = generateCacheKey(timelineItemId, framePosition, clipStartTime, clipEndTime)
    const cached = thumbnailCache.value.get(cacheKey)
    return cached?.blobUrl || null
  }

  return {
    requestThumbnails,
    cancelTasks,
    cleanup,
    pendingRequests, // 可选：用于调试
    
    // 缓存管理相关导出
    thumbnailCache,
    clearThumbnailCacheByTimelineItem,
    cleanupThumbnailCache,
    getCachedThumbnail,
    cacheThumbnail,
    
    // 工具函数导出
    generateCacheKey,
    getThumbnailUrl
  }
}

export type UnifiedThumbnailSchedulerModule = ReturnType<typeof createUnifiedThumbnailSchedulerModule>
```

### 2. 模块导出

**文件**: `frontend/src/unified/modules/index.ts`

```typescript
// ==================== 统一缩略图调度器模块 ====================
export {
  createUnifiedThumbnailSchedulerModule,
  type UnifiedThumbnailSchedulerModule
} from './UnifiedThumbnailSchedulerModule'
```

### 3. 集成到 unifiedStore

**文件**: `frontend/src/unified/unifiedStore.ts`

```typescript
// 导入新模块
import { createUnifiedThumbnailSchedulerModule } from '@/unified/modules/UnifiedThumbnailSchedulerModule'

export const useUnifiedStore = defineStore('unified', () => {
  // ... 其他模块初始化

  // 创建缩略图调度器模块
  const unifiedThumbnailSchedulerModule = createUnifiedThumbnailSchedulerModule({
    timelineModule: {
      getTimelineItem: unifiedTimelineModule.getTimelineItem
    },
    mediaModule: {
      getMediaItem: unifiedMediaModule.getMediaItem
    },
    configModule: {
      frameRate: unifiedConfigModule.frameRate
    },
  })

  return {
    // ... 其他导出

    // 缩略图调度器方法
    requestThumbnails: unifiedThumbnailSchedulerModule.requestThumbnails,
    cancelThumbnailTasks: unifiedThumbnailSchedulerModule.cancelTasks,
    cleanupThumbnailScheduler: unifiedThumbnailSchedulerModule.cleanup,

    // 缩略图缓存功能（通过模块提供）
    thumbnailCache: unifiedThumbnailSchedulerModule.thumbnailCache,
    clearThumbnailCacheByTimelineItem: unifiedThumbnailSchedulerModule.clearThumbnailCacheByTimelineItem,
    cleanupThumbnailCache: unifiedThumbnailSchedulerModule.cleanupThumbnailCache,
    getCachedThumbnail: unifiedThumbnailSchedulerModule.getCachedThumbnail,
    cacheThumbnail: unifiedThumbnailSchedulerModule.cacheThumbnail,
    
    // 工具函数导出
    generateCacheKey: unifiedThumbnailSchedulerModule.generateCacheKey,
    getThumbnailUrl: unifiedThumbnailSchedulerModule.getThumbnailUrl
  }
})
```

### 4. 调用方更新

**文件**: `frontend/src/unified/components/renderers/VideoContent.vue`

```typescript
// 移除旧的导入
// import { thumbnailScheduler } from '@/unified/managers/ThumbnailScheduler'

// 使用新的store方法
const unifiedStore = useUnifiedStore()

// 更新调用方式
unifiedStore.requestThumbnails({
  timelineItemId: props.data.id,
  thumbnailLayout: uncachedItems,
  timestamp: Date.now()
})

// 取消任务
unifiedStore.cancelThumbnailTasks(props.data.id)
```

## 迁移实施步骤

### 第一步：创建新模块
1. 创建 `UnifiedThumbnailSchedulerModule.ts` 文件
2. 迁移核心逻辑，保持接口兼容
3. 实现依赖注入

### 第二步：集成到store
1. 在 `unifiedStore.ts` 中初始化模块
2. 导出相关方法

### 第三步：更新调用方
1. 修改 `VideoContent.vue` 中的导入和调用方式
2. 检查其他可能使用缩略图调度器的地方

### 第四步：清理旧代码
1. 移除 `ThumbnailScheduler.ts` 文件
2. 清理相关导入

## 缓存功能迁移说明

### 迁移内容
1. **状态迁移**: 将 `unifiedStore.ts` 中的 `thumbnailCache` ref 迁移到模块中
2. **方法迁移**: 迁移两个缓存管理方法：
   - `clearThumbnailCacheByTimelineItem`
   - `cleanupThumbnailCache`
3. **新增方法**: 添加缓存查询和管理方法：
   - `getCachedThumbnail`
   - `cacheThumbnail`

### 资源管理
确保正确的Blob URL资源释放，防止内存泄漏：
```typescript
function cacheThumbnail(thumbnail: CachedThumbnail) {
  // 检查是否已存在相同key的缓存，如果存在则释放旧的Blob URL
  const existing = thumbnailCache.value.get(generateCacheKey(thumbnail.timelineItemId, thumbnail.framePosition))
  if (existing && existing.blobUrl.startsWith('blob:')) {
    URL.revokeObjectURL(existing.blobUrl)
  }
  
  thumbnailCache.value.set(generateCacheKey(thumbnail.timelineItemId, thumbnail.framePosition), thumbnail)
}
```

## 优势分析

1. **更好的模块化**: 符合统一架构标准
2. **功能整合**: 缩略图生成和缓存功能统一管理
3. **依赖清晰**: 明确的依赖注入，减少隐式依赖
4. **可测试性**: 模块化设计便于单元测试
5. **一致性**: 与现有模块系统保持一致
6. **可维护性**: 清晰的接口和依赖关系
7. **资源管理**: 统一的Blob URL生命周期管理

## 风险与注意事项

1. **接口兼容性**: 确保新模块的方法签名与旧版本完全一致
2. **性能影响**: 节流处理器的性能需要测试验证
3. **错误处理**: 保持原有的错误处理机制
4. **并发安全**: 确保多请求场景下的线程安全
5. **缓存一致性**: 确保缓存迁移后数据一致性
6. **内存泄漏**: 完善Blob URL资源释放机制
7. **资源管理**: 确保缩略图缓存正确清理

## 测试计划

1. **单元测试**: 对新模块进行全面的单元测试
2. **集成测试**: 测试与store的集成效果
3. **功能测试**: 验证缩略图生成功能正常
4. **性能测试**: 测试节流处理的性能表现

## 总结

这个重构方案将ThumbnailScheduler从独立类成功转换为模块化架构，保持了功能完整性，同时提升了代码的可维护性和一致性。实施过程中需要仔细处理依赖关系和接口兼容性。