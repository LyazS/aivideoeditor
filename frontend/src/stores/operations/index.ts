// 整个操作系统导出

// 导入内部使用的类（用于createOperationSystem函数）
import { OperationContext } from './context'
import { OperationFactory } from './factory'
import { OperationSystemManager } from './OperationSystemManager'

// 类型导出
export type { Operation, CompositeOperation, OperationResult } from './types'
export { ExecutionStrategy } from './types'

// 基础类导出
export { AtomicOperation, CompositeOperationImpl } from './base'

// 历史管理导出
export { HistoryManager, ReactiveHistoryManager } from './history'
export type { HistoryListener, HistorySummary, OperationNotification } from './history'

// 高级功能导出
export { OperationScheduler, OperationAnalyzer } from './advanced'
export type { ScheduleOptions, BatchScheduleOptions, QueueStatus, OperationRecord, PerformanceReport } from './advanced'

// 系统管理器导出
export { OperationSystemManager } from './OperationSystemManager'
export type { SystemStatus } from './OperationSystemManager'

// 上下文导出
export { OperationContext } from './context'
export type {
  TimelineService,
  CanvasService,
  TrackService,
  MediaService,
  WebAVService,
  TimelineItemData,
  TransformData,
  Position
} from './context'

// 工厂导出
export { OperationFactory } from './factory'

// 工具导出
export { generateId, OperationUtils, ValidationUtils } from './utils'

// 适配器导出（延迟导出以避免循环依赖）
// export {
//   TimelineServiceAdapter,
//   CanvasServiceAdapter,
//   TrackServiceAdapter,
//   MediaServiceAdapter,
//   WebAVServiceAdapter
// } from './context'

// 操作实现导出
export {
  AddTimelineItemOperation,
  RemoveTimelineItemOperation,
  MoveTimelineItemOperation,
  TransformTimelineItemOperation,
  AddTrackOperation,
  RemoveTrackOperation,
  RenameTrackOperation,
  VolumeChangeOperation,
  MuteToggleOperation
} from './implementations'

/**
 * 创建操作系统
 * 提供完整的操作系统初始化
 */
export function createOperationSystem(modules: {
  timelineModule: any
  webavModule: any
  trackModule: any
  mediaModule: any
  configModule: any
}) {
  // 临时解决方案：直接创建简化的适配器
  const timelineService = {
    addItem: (item: any) => modules.timelineModule.addTimelineItem(item),
    removeItem: (itemId: string) => modules.timelineModule.removeTimelineItem(itemId),
    getItem: (itemId: string) => modules.timelineModule.getTimelineItem(itemId),
    getItemsInTrack: (trackId: number) => modules.timelineModule.timelineItems.value.filter((item: any) => item.trackId === trackId),
    updateItem: (itemId: string, updates: any) => {
      const item = modules.timelineModule.getTimelineItem(itemId)
      if (item) Object.assign(item, updates)
    }
  }

  const canvasService = {
    addSprite: (sprite: any) => modules.webavModule.addSprite(sprite),
    removeSprite: (sprite: any) => modules.webavModule.removeSprite(sprite),
    updateSprite: (sprite: any) => {} // WebAV sprites auto-update
  }

  const trackService = {
    createTrack: (data: any) => modules.trackModule.addTrack(data.name),
    removeTrack: (trackId: number) => modules.trackModule.removeTrack(trackId, modules.timelineModule.timelineItems),
    getTrack: (trackId: number) => modules.trackModule.getTrack(trackId),
    getNextTrackNumber: () => Math.max(...modules.trackModule.tracks.value.map((t: any) => t.id)) + 1,
    updateTrack: (trackId: number, updates: any) => {
      const track = modules.trackModule.getTrack(trackId)
      if (track) {
        Object.assign(track, updates)
        if (updates.name) modules.trackModule.renameTrack(trackId, updates.name)
      }
    }
  }

  const mediaService = {
    getItem: (mediaItemId: string) => modules.mediaModule.getMediaItem(mediaItemId),
    addItem: (item: any) => modules.mediaModule.addMediaItem(item, modules.timelineModule.timelineItems, modules.trackModule.tracks),
    removeItem: (mediaItemId: string) => {
      const index = modules.mediaModule.mediaItems.value.findIndex((item: any) => item.id === mediaItemId)
      if (index > -1) modules.mediaModule.mediaItems.value.splice(index, 1)
    },
    getVideoOriginalResolution: (mediaItemId: string) => modules.mediaModule.getVideoOriginalResolution(mediaItemId),
    getImageOriginalResolution: (mediaItemId: string) => modules.mediaModule.getImageOriginalResolution(mediaItemId)
  }

  const webavService = {
    cloneMP4Clip: async (clip: any) => {
      try {
        // 使用WebAV内置的clone方法进行真正的克隆
        const clonedClip = await clip.clone()
        return clonedClip
      } catch (error) {
        console.error('❌ 克隆MP4Clip失败:', error)
        throw new Error(`克隆MP4Clip失败: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    },
    cloneImgClip: async (clip: any) => {
      try {
        // 使用WebAV内置的clone方法进行真正的克隆
        const clonedClip = await clip.clone()
        return clonedClip
      } catch (error) {
        console.error('❌ 克隆ImgClip失败:', error)
        throw new Error(`克隆ImgClip失败: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    },
    getCanvas: () => modules.webavModule.avCanvas.value || undefined
  }

  const configService = {
    videoResolution: modules.configModule.videoResolution
  }

  // 创建操作上下文
  const context = new OperationContext(
    timelineService as any,
    canvasService as any,
    trackService as any,
    mediaService as any,
    webavService as any,
    configService as any
  )

  // 创建操作工厂
  const factory = new OperationFactory(context)

  // 创建现代化操作系统管理器
  const systemManager = new OperationSystemManager(context, factory)

  return {
    // 主要接口
    systemManager,

    // 直接访问组件（用于高级用法）
    context,
    factory,
    history: systemManager.history,
    scheduler: systemManager.scheduler,
    analyzer: systemManager.analyzer,

    // 服务适配器（用于调试和测试）
    services: {
      timeline: timelineService,
      canvas: canvasService,
      track: trackService,
      media: mediaService,
      webav: webavService
    },

    // 便捷初始化方法
    async initialize() {
      await systemManager.initialize()
      console.log('🎉 现代化操作系统已就绪！')
      return systemManager
    }
  }
}
