/**
 * 统一时间轴项目模块主入口
 * 
 * 基于重构文档：10-统一时间轴项目设计-类型设计.md
 * 
 * 核心设计理念：
 * - 状态驱动的统一架构：将"本地"和"异步"从类型区分改为状态区分
 * - 3状态简化方案：ready | loading | error
 * - 响应式数据结构：核心数据 + 行为函数 + 查询函数
 * - 状态上下文承载细节：StatusContext承载当前状态的详细信息
 */

// ==================== 核心类型导出 ====================

export type {
  // 核心接口
  UnifiedTimelineItem,
  TimelineItemStatus,
  
  // 状态上下文
  TimelineStatusContext,
  DownloadContext,
  ParseContext,
  ProcessingContext,
  ReadyContext,
  ErrorContext,
  
  // 配置类型
  BasicTimelineConfig,
  VideoMediaConfig,
  ImageMediaConfig,
  AudioMediaConfig,
  TextMediaConfig,
  TextStyleConfig,
  GetMediaConfig,
  
  // 动画类型
  AnimationConfig,
  Keyframe,
  GetKeyframeProperties,
  
  // 事件类型
  ExtendedPropsChangeEvent
} from './types'

// ==================== 常量导出 ====================

export {
  VALID_TIMELINE_TRANSITIONS
} from './types'

// ==================== 查询函数导出 ====================

export {
  UnifiedTimelineItemQueries,
  TimelineContextUtils
} from './queries'

// ==================== 行为函数导出 ====================

export {
  UnifiedTimelineItemActions
} from './actions'

// ==================== 上下文模板导出 ====================

export {
  TIMELINE_CONTEXT_TEMPLATES,
  createDownloadContext,
  createParseContext,
  createProcessingContext,
  createReadyContext,
  createErrorContext
} from './contextTemplates'

// ==================== 工厂函数导出 ====================

export {
  createUnifiedTimelineItem,
  createTimelineItemForMediaType,
  createVideoTimelineItem,
  createImageTimelineItem,
  createAudioTimelineItem,
  createTextTimelineItem,
  cloneTimelineItem,
  createMultipleTimelineItems,
  restoreTimelineItemFromData,
  generateTimelineItemId,
  DEFAULT_TEXT_STYLE,
  DEFAULT_MEDIA_CONFIGS
} from './factory'

export type {
  CreateTimelineItemParams
} from './factory'

// ==================== 便捷工具函数 ====================

// 导入需要的类型用于工具函数
import type { UnifiedTimelineItem, TimelineItemStatus } from './types'

/**
 * 媒体状态到时间轴状态的映射
 * 基于重构文档中的简化映射关系
 */
export const MEDIA_TO_TIMELINE_STATUS_MAP = {
  'pending': 'loading' as const,           // 等待开始处理
  'asyncprocessing': 'loading' as const,   // 下载/获取中（显示下载进度）
  'webavdecoding': 'loading' as const,     // 解析中（显示"解析中..."文案）
  'ready': 'ready' as const,               // 完全就绪
  'error': 'error' as const,               // 各种错误状态
  'cancelled': 'error' as const,           // 用户取消
  'missing': 'error' as const              // 文件缺失
} as const

/**
 * 将媒体状态映射为时间轴状态
 */
export function mapMediaStatusToTimelineStatus(mediaStatus: string): TimelineItemStatus {
  return MEDIA_TO_TIMELINE_STATUS_MAP[mediaStatus as keyof typeof MEDIA_TO_TIMELINE_STATUS_MAP] || 'error'
}

/**
 * 检查时间轴项目是否需要Sprite
 */
export function shouldHaveSprite(item: UnifiedTimelineItem): boolean {
  return item.timelineStatus === 'ready'
}

/**
 * 检查时间轴项目状态是否一致
 */
export function isTimelineItemStateConsistent(item: UnifiedTimelineItem): boolean {
  const hasSprite = !!item.sprite
  const shouldHave = shouldHaveSprite(item)
  return hasSprite === shouldHave
}

/**
 * 获取时间轴项目的显示状态文本
 */
export function getTimelineItemDisplayStatus(item: UnifiedTimelineItem): string {
  if (item.statusContext) {
    return item.statusContext.message
  }
  
  switch (item.timelineStatus) {
    case 'loading':
      return '正在处理...'
    case 'ready':
      return '已就绪'
    case 'error':
      return '发生错误'
    default:
      return '未知状态'
  }
}

/**
 * 获取时间轴项目的进度信息
 */
export function getTimelineItemProgress(item: UnifiedTimelineItem): {
  hasProgress: boolean
  percent?: number
  detail?: string
} {
  if (!item.statusContext || !('progress' in item.statusContext)) {
    return { hasProgress: false }
  }
  
  return {
    hasProgress: true,
    percent: item.statusContext.progress.percent,
    detail: item.statusContext.progress.detail
  }
}

/**
 * 检查时间轴项目是否可以播放
 */
export function canPlayTimelineItem(item: UnifiedTimelineItem): boolean {
  return item.timelineStatus === 'ready' && !!item.sprite
}

/**
 * 获取时间轴项目的错误信息
 */
export function getTimelineItemError(item: UnifiedTimelineItem): {
  hasError: boolean
  code?: string
  message?: string
  recoverable?: boolean
} {
  if (item.timelineStatus !== 'error' || !item.statusContext || !('error' in item.statusContext)) {
    return { hasError: false }
  }
  
  return {
    hasError: true,
    code: item.statusContext.error.code,
    message: item.statusContext.error.message,
    recoverable: item.statusContext.error.recoverable
  }
}

// ==================== 调试工具 ====================

/**
 * 获取时间轴项目的调试信息
 */
export function getTimelineItemDebugInfo(item: UnifiedTimelineItem): object {
  return {
    id: item.id,
    mediaItemId: item.mediaItemId,
    trackId: item.trackId,
    status: item.timelineStatus,
    mediaType: item.mediaType,
    hasSprite: !!item.sprite,
    hasStatusContext: !!item.statusContext,
    statusStage: item.statusContext?.stage,
    timeRange: item.timeRange,
    configName: item.config.name,
    hasAnimation: !!item.config.animation?.isEnabled
  }
}

/**
 * 打印时间轴项目的调试信息
 */
export function debugTimelineItem(item: UnifiedTimelineItem): void {
  console.log('🔍 [TimelineItem Debug]', getTimelineItemDebugInfo(item))
}
