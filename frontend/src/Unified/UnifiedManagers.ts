/**
 * 统一管理器API契约文档
 *
 * ⚠️ 重要说明：此文件仅作为API契约文档和类型定义使用
 *
 * 📋 文件作用：
 * 1. 定义各种管理器应该提供的功能接口
 * 2. 作为开发团队的API设计参考文档
 * 3. 提供TypeScript类型定义支持
 *
 * 🚫 不要直接实现这些接口为管理器类！
 *
 * ✅ 正确的实现方式：
 * - 使用 Pinia Store 模块 (stores/modules/)
 * - 使用 Vue Composables (composables/)
 * - 使用工具函数模块 (utils/)
 *
 * 📖 示例：
 * ```typescript
 * // ❌ 错误：不要这样实现
 * class MediaManagerImpl implements UnifiedMediaManager { ... }
 *
 * // ✅ 正确：使用现有架构
 * export const useMediaStore = defineStore('media', () => {
 *   // 实现 UnifiedMediaManager 接口中定义的功能
 * })
 *
 * export function useMediaManager() {
 *   // 封装复杂的媒体操作逻辑
 * }
 * ```
 *
 * 🎯 目标：保持项目架构一致性，使用 Vue 3 + Pinia 最佳实践
 */

import type { BaseDataSource } from './sources/BaseDataSource'
import type { UnifiedMediaItem } from './UnifiedMediaItem'
import type { UnifiedTimelineItem } from './UnifiedTimelineItem'
import type { UnifiedCommand, StateSnapshot } from './UnifiedCommand'

// ==================== 媒体项目管理器API契约 ====================

/**
 * 统一媒体项目管理器API契约
 *
 * 📋 功能说明：定义媒体项目管理应该提供的核心功能
 * 🏗️ 实现方式：通过 stores/modules/mediaModule.ts 和相关 composables 实现
 * 📖 使用示例：const mediaStore = useMediaStore()
 */
export interface UnifiedMediaManager {
  /**
   * 创建媒体项目
   */
  createMediaItem(options: {
    name: string
    source: BaseDataSource
    mediaType?: string
  }): Promise<UnifiedMediaItem>
  
  /**
   * 获取媒体项目
   */
  getMediaItem(id: string): UnifiedMediaItem | undefined
  
  /**
   * 获取所有媒体项目
   */
  getAllMediaItems(): UnifiedMediaItem[]
  
  /**
   * 删除媒体项目
   */
  removeMediaItem(id: string): Promise<void>
  
  /**
   * 更新媒体项目
   */
  updateMediaItem(id: string, updates: Partial<UnifiedMediaItem>): Promise<void>
  
  /**
   * 等待媒体项目就绪
   */
  waitForMediaItemReady(id: string, timeout?: number): Promise<boolean>
  
  /**
   * 批量处理媒体项目
   */
  batchProcessMediaItems(ids: string[]): Promise<void>
  
  /**
   * 获取处理统计信息
   */
  getProcessingStats(): {
    total: number
    ready: number
    processing: number
    error: number
  }
}

// ==================== 时间轴项目管理器API契约 ====================

/**
 * 统一时间轴项目管理器API契约
 *
 * 📋 功能说明：定义时间轴项目管理应该提供的核心功能
 * 🏗️ 实现方式：通过 stores/modules/timelineModule.ts 和相关 composables 实现
 * 📖 使用示例：const timelineStore = useVideoStore() // timelineModule 集成在 videoStore 中
 */
export interface UnifiedTimelineManager {
  /**
   * 创建时间轴项目
   */
  createTimelineItem(options: {
    mediaItemId: string
    trackId: string
    timeRange: { timelineStartTime: number; timelineEndTime: number }
    config: any
  }): Promise<UnifiedTimelineItem>
  
  /**
   * 获取时间轴项目
   */
  getTimelineItem(id: string): UnifiedTimelineItem | undefined
  
  /**
   * 获取轨道上的所有项目
   */
  getTimelineItemsByTrack(trackId: string): UnifiedTimelineItem[]
  
  /**
   * 获取所有时间轴项目
   */
  getAllTimelineItems(): UnifiedTimelineItem[]
  
  /**
   * 删除时间轴项目
   */
  removeTimelineItem(id: string): Promise<void>
  
  /**
   * 更新时间轴项目
   */
  updateTimelineItem(id: string, updates: Partial<UnifiedTimelineItem>): Promise<void>
  
  /**
   * 移动时间轴项目
   */
  moveTimelineItem(id: string, newTrackId: string, newTimeRange: { timelineStartTime: number; timelineEndTime: number }): Promise<void>
  
  /**
   * 复制时间轴项目
   */
  duplicateTimelineItem(id: string): Promise<UnifiedTimelineItem>
  
  /**
   * 批量操作时间轴项目
   */
  batchUpdateTimelineItems(updates: Array<{ id: string; updates: Partial<UnifiedTimelineItem> }>): Promise<void>
}

// ==================== Sprite生命周期管理器API契约 ====================

/**
 * Sprite生命周期管理器API契约
 *
 * 📋 功能说明：定义Sprite生命周期管理应该提供的核心功能
 * 🏗️ 实现方式：通过 stores/modules/webavModule.ts 和相关工具函数实现
 * 📖 使用示例：const webavStore = useVideoStore() // webavModule 集成在 videoStore 中
 */
export interface SpriteLifecycleManager {
  /**
   * 创建Sprite
   */
  createSprite(timelineItem: UnifiedTimelineItem): Promise<void>
  
  /**
   * 销毁Sprite
   */
  destroySprite(timelineItem: UnifiedTimelineItem): Promise<void>
  
  /**
   * 更新Sprite
   */
  updateSprite(timelineItem: UnifiedTimelineItem): Promise<void>
  
  /**
   * 批量创建Sprite
   */
  batchCreateSprites(timelineItems: UnifiedTimelineItem[]): Promise<void>
  
  /**
   * 批量销毁Sprite
   */
  batchDestroySprites(timelineItems: UnifiedTimelineItem[]): Promise<void>
  
  /**
   * 清理所有Sprite
   */
  cleanupAllSprites(): Promise<void>
  
  /**
   * 获取Sprite统计信息
   */
  getSpriteStats(): {
    total: number
    active: number
    inactive: number
  }
}

// ==================== 命令历史管理器API契约 ====================

/**
 * 命令历史管理器API契约
 *
 * 📋 功能说明：定义命令历史管理应该提供的核心功能
 * 🏗️ 实现方式：通过 stores/modules/historyModule.ts 和相关 composables 实现
 * 📖 使用示例：const historyStore = useVideoStore() // historyModule 集成在 videoStore 中
 */
export interface CommandHistoryManager {
  /**
   * 执行命令
   */
  executeCommand(command: UnifiedCommand): Promise<void>
  
  /**
   * 撤销操作
   */
  undo(): Promise<boolean>
  
  /**
   * 重做操作
   */
  redo(): Promise<boolean>
  
  /**
   * 检查是否可以撤销
   */
  canUndo(): boolean
  
  /**
   * 检查是否可以重做
   */
  canRedo(): boolean
  
  /**
   * 获取历史记录
   */
  getHistory(): UnifiedCommand[]
  
  /**
   * 获取撤销栈
   */
  getUndoStack(): UnifiedCommand[]
  
  /**
   * 获取重做栈
   */
  getRedoStack(): UnifiedCommand[]
  
  /**
   * 清空历史记录
   */
  clearHistory(): void
  
  /**
   * 设置历史记录限制
   */
  setHistoryLimit(limit: number): void
  
  /**
   * 创建状态快照
   */
  createSnapshot(): StateSnapshot
  
  /**
   * 恢复到指定快照
   */
  restoreSnapshot(snapshot: StateSnapshot): Promise<void>
}

// ==================== 通知管理器API契约 ====================

/**
 * 通知管理器API契约
 *
 * 📋 功能说明：定义通知管理应该提供的核心功能
 * 🏗️ 实现方式：通过 stores/modules/notificationModule.ts 和相关组件实现
 * 📖 使用示例：const notificationStore = useVideoStore() // notificationModule 集成在 videoStore 中
 */
export interface NotificationManager {
  /**
   * 显示成功通知
   */
  showSuccess(title: string, message?: string, duration?: number): string
  
  /**
   * 显示错误通知
   */
  showError(title: string, message?: string, duration?: number): string
  
  /**
   * 显示警告通知
   */
  showWarning(title: string, message?: string, duration?: number): string
  
  /**
   * 显示信息通知
   */
  showInfo(title: string, message?: string, duration?: number): string
  
  /**
   * 显示进度通知
   */
  showProgress(title: string, progress: number, message?: string): string
  
  /**
   * 更新进度通知
   */
  updateProgress(id: string, progress: number, message?: string): void
  
  /**
   * 关闭通知
   */
  close(id: string): void
  
  /**
   * 关闭所有通知
   */
  closeAll(): void
}
