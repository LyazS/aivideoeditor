/**
 * 统一管理器类型设计
 * 
 * 定义各种管理器的接口，包括数据源管理器、媒体项目管理器、
 * 时间轴项目管理器、命令历史管理器等
 */

import type { BaseDataSource } from './sources/BaseDataSource'
import type { UnifiedMediaItem } from './UnifiedMediaItem'
import type { UnifiedTimelineItem } from './UnifiedTimelineItem'
import type { UnifiedCommand, StateSnapshot } from './UnifiedCommand'

// ==================== 数据源管理器接口 ====================

/**
 * 数据源管理器基础接口
 */
export interface DataSourceManager<T extends BaseDataSource> {
  /**
   * 开始获取数据源
   */
  startAcquisition(source: T, taskId: string): void
  
  /**
   * 取消获取操作
   */
  cancelAcquisition(taskId: string): void
  
  /**
   * 获取正在进行的任务数量
   */
  getActiveTaskCount(): number
  
  /**
   * 获取任务状态
   */
  getTaskStatus(taskId: string): string | undefined
  
  /**
   * 清理已完成的任务
   */
  cleanupCompletedTasks(): void
}

/**
 * 用户选择文件管理器接口
 */
export interface UserSelectedFileManager extends DataSourceManager<BaseDataSource> {
  /**
   * 验证文件有效性
   */
  validateFile(file: File): Promise<boolean>
  
  /**
   * 获取文件类型
   */
  detectFileType(file: File): Promise<string>
  
  /**
   * 批量处理文件
   */
  processBatch(files: File[]): Promise<void>
}

/**
 * 工程文件管理器接口
 */
export interface ProjectFileManager extends DataSourceManager<BaseDataSource> {
  /**
   * 检查文件是否存在
   */
  checkFileExists(filePath: string): Promise<boolean>
  
  /**
   * 重新定位文件
   */
  relocateFile(originalPath: string, newFile: File): Promise<void>
  
  /**
   * 批量重新定位文件
   */
  batchRelocateFiles(relocations: Array<{ originalPath: string; newFile: File }>): Promise<void>
  
  /**
   * 获取缺失文件列表
   */
  getMissingFiles(): string[]
}

/**
 * 远程文件管理器接口
 */
export interface RemoteFileManager extends DataSourceManager<BaseDataSource> {
  /**
   * 设置并发下载限制
   */
  setConcurrencyLimit(limit: number): void
  
  /**
   * 获取下载统计信息
   */
  getDownloadStats(): {
    totalDownloads: number
    activeDownloads: number
    completedDownloads: number
    failedDownloads: number
    totalBytes: number
    downloadedBytes: number
  }
  
  /**
   * 暂停所有下载
   */
  pauseAllDownloads(): void
  
  /**
   * 恢复所有下载
   */
  resumeAllDownloads(): void
  
  /**
   * 清理下载缓存
   */
  clearDownloadCache(): void
}

// ==================== 媒体项目管理器接口 ====================

/**
 * 统一媒体项目管理器接口
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

// ==================== 时间轴项目管理器接口 ====================

/**
 * 统一时间轴项目管理器接口
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

// ==================== Sprite生命周期管理器接口 ====================

/**
 * Sprite生命周期管理器接口
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

// ==================== 命令历史管理器接口 ====================

/**
 * 命令历史管理器接口
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

// ==================== 通知管理器接口 ====================

/**
 * 通知管理器接口
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

// ==================== 管理器工厂接口 ====================

/**
 * 管理器工厂接口
 */
export interface ManagerFactory {
  /**
   * 创建用户选择文件管理器
   */
  createUserSelectedFileManager(): UserSelectedFileManager
  
  /**
   * 创建工程文件管理器
   */
  createProjectFileManager(): ProjectFileManager
  
  /**
   * 创建远程文件管理器
   */
  createRemoteFileManager(): RemoteFileManager
  
  /**
   * 创建统一媒体管理器
   */
  createUnifiedMediaManager(): UnifiedMediaManager
  
  /**
   * 创建统一时间轴管理器
   */
  createUnifiedTimelineManager(): UnifiedTimelineManager
  
  /**
   * 创建Sprite生命周期管理器
   */
  createSpriteLifecycleManager(): SpriteLifecycleManager
  
  /**
   * 创建命令历史管理器
   */
  createCommandHistoryManager(): CommandHistoryManager
  
  /**
   * 创建通知管理器
   */
  createNotificationManager(): NotificationManager
}
