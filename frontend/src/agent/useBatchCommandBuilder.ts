/**
 * 批量命令构建器 - 组合式API版本
 * 将操作配置转换为具体命令，专注于命令构建，不负责执行
 */

import type { Ref } from 'vue'
import type { SimpleCommand } from '@/unified/modules/commands/types'
import type { MediaType } from '@/unified/mediaitem/types'
import type {
  VideoMediaConfig,
  ImageMediaConfig,
  AudioMediaConfig,
  TextMediaConfig,
} from '@/unified/timelineitem/TimelineItemData'
import type {
  UnifiedHistoryModule,
  UnifiedTimelineModule,
  UnifiedWebavModule,
  UnifiedMediaModule,
  UnifiedConfigModule,
  UnifiedTrackModule,
  UnifiedSelectionModule,
} from '@/unified/modules'
import { useUnifiedStore } from '@/unified/unifiedStore'
import { useTimelineItemOperations } from '@/unified/composables/useTimelineItemOperations'
import { AddTimelineItemCommand } from '@/unified/modules/commands/AddTimelineItemCommand'
import { timecodeToFrames } from '@/unified/utils/timeUtils'
import { generateId } from '@/unified/utils/idGenerator'
import { UnifiedMediaItemQueries } from '@/unified/mediaitem/queries'

// 操作配置接口 - 从 BatchCommandBuilder.ts 迁移
export interface AddTimelineItemOperation {
  type: 'addTimelineItem'
  params: {
    mediaItemId: string
    trackId: string
    position: string // 时间轴位置（时间码）
  }
}

export interface AddTextTimelineItemOperation {
  type: 'addTextTimelineItem'
  params: {
    content: string
    trackId: string
    startPostion: string // 时间轴开始时间（时间码）
    endPostion: string // 时间轴结束时间（时间码）
  }
}

export interface RemoveTimelineItemOperation {
  type: 'rmTimelineItem'
  params: {
    timelineItemId: string
  }
}

export interface MoveTimelineItemOperation {
  type: 'mvTimelineItem'
  params: {
    timelineItemId: string
    newPosition: string
    newTrackId?: string
  }
}

export interface UpdateTransformOperation {
  type: 'updateTimelineItemTransform'
  params: {
    timelineItemId: string
    newTransform: {
      x?: number
      y?: number
      width?: number
      height?: number
      rotation?: number
      opacity?: number
      zIndex?: number
      duration?: string
      playbackRate?: number
      volume?: number
      isMuted?: boolean
      gain?: number
    }
  }
}

export interface SplitTimelineItemOperation {
  type: 'splitTimelineItem'
  params: {
    timelineItemId: string
    splitPosition: string
  }
}

export interface CopyTimelineItemOperation {
  type: 'cpTimelineItem'
  params: {
    timelineItemId: string
    newPosition?: string
    newTrackId?: string
  }
}

export interface ResizeTimelineItemOperation {
  type: 'resizeTimelineItem'
  params: {
    timelineItemId: string
    newTimeRange: {
      timelineStart: string
      timelineEnd: string
      clipStart: string
      clipEnd: string
    }
  }
}

export interface AddTrackOperation {
  type: 'addTrack'
  params: {
    type?: 'video' | 'audio' | 'text'
    position?: number
  }
}

export interface RemoveTrackOperation {
  type: 'rmTrack'
  params: {
    trackId: string
  }
}

export interface RenameTrackOperation {
  type: 'renameTrack'
  params: {
    trackId: string
    newName: string
  }
}

export interface AutoArrangeTrackOperation {
  type: 'autoArrangeTrack'
  params: {
    trackId: string
  }
}

export interface ToggleTrackVisibilityOperation {
  type: 'toggleTrackVisibility'
  params: {
    trackId: string
    visible?: boolean
  }
}

export interface ToggleTrackMuteOperation {
  type: 'toggleTrackMute'
  params: {
    trackId: string
    muted?: boolean
  }
}

export interface UpdateTextContentOperation {
  type: 'updateTextContent'
  params: {
    timelineItemId: string
    newText: string
    newStyle?: Partial<TextStyleConfig>
  }
}

export interface UpdateTextStyleOperation {
  type: 'updateTextStyle'
  params: {
    timelineItemId: string
    newStyle: Partial<TextStyleConfig>
  }
}

export interface CreateKeyframeOperation {
  type: 'createKeyframe'
  params: {
    timelineItemId: string
    position: string
  }
}

export interface DeleteKeyframeOperation {
  type: 'deleteKeyframe'
  params: {
    timelineItemId: string
    position: string
  }
}

export interface UpdateKeyframePropertyOperation {
  type: 'updateKeyframeProperty'
  params: {
    timelineItemId: string
    position: string
    property: string
    value: any
  }
}

export interface ClearAllKeyframesOperation {
  type: 'clearAllKeyframes'
  params: {
    timelineItemId: string
  }
}

// 文本样式配置接口
export interface TextStyleConfig {
  fontSize: number
  fontFamily: string
  fontWeight: string | number
  fontStyle: 'normal' | 'italic'
  color: string
  backgroundColor?: string
  textShadow?: string
  textStroke?: {
    width: number
    color: string
  }
  textGlow?: {
    color: string
    blur: number
    spread?: number
  }
  textAlign: 'left' | 'center' | 'right'
  lineHeight?: number
  maxWidth?: number
  customFont?: {
    name: string
    url: string
  }
}

// 联合类型表示所有可能的操作
export type OperationConfig =
  | AddTimelineItemOperation
  | AddTextTimelineItemOperation
  | RemoveTimelineItemOperation
  | MoveTimelineItemOperation
  | UpdateTransformOperation
  | SplitTimelineItemOperation
  | CopyTimelineItemOperation
  | ResizeTimelineItemOperation
  | AddTrackOperation
  | RemoveTrackOperation
  | RenameTrackOperation
  | AutoArrangeTrackOperation
  | ToggleTrackVisibilityOperation
  | ToggleTrackMuteOperation
  | UpdateTextContentOperation
  | UpdateTextStyleOperation
  | CreateKeyframeOperation
  | DeleteKeyframeOperation
  | UpdateKeyframePropertyOperation
  | ClearAllKeyframesOperation

// 构建结果接口
export interface OperationResult {
  success: boolean
  operation: OperationConfig
  error?: string
}

export interface BuildResult {
  batchCommand: any // BaseBatchCommand 类型
  buildResults: OperationResult[]
}

/**
 * 批量命令构建器组合式函数
 * 提供批量操作配置到命令的转换功能
 */
export function useBatchCommandBuilder(
  unifiedHistoryModule: UnifiedHistoryModule,
  unifiedTimelineModule: UnifiedTimelineModule,
  unifiedWebavModule: UnifiedWebavModule,
  unifiedMediaModule: UnifiedMediaModule,
  unifiedConfigModule: UnifiedConfigModule,
  unifiedTrackModule: UnifiedTrackModule,
  unifiedSelectionModule: UnifiedSelectionModule,
) {
  // 使用统一存储
  const unifiedStore = useUnifiedStore()
  const { createEnhancedDefaultConfig } = useTimelineItemOperations()

  /**
   * 构建批量操作命令
   */
  function buildOperations(operations: OperationConfig[]): BuildResult {
    const batchBuilder = unifiedStore.startBatch('用户脚本批量操作')
    const buildResults: OperationResult[] = []

    for (const op of operations) {
      try {
        const command = createCommandFromOperation(op)
        batchBuilder.addCommand(command)
        buildResults.push({ success: true, operation: op })
      } catch (error: any) {
        buildResults.push({
          success: false,
          operation: op,
          error: error.message,
        })
      }
    }

    return {
      batchCommand: batchBuilder.build(),
      buildResults,
    }
  }

  /**
   * 根据操作类型创建对应的命令
   */
  function createCommandFromOperation(op: OperationConfig): SimpleCommand {
    switch (op.type) {
      case 'addTimelineItem':
        return createAddTimelineItemCommand(op.params)
      // 其他命令类型暂时不实现
      default:
        throw new Error(`不支持的操作类型: ${op.type}`)
    }
  }

  /**
   * 创建添加时间轴项目命令
   */
  function createAddTimelineItemCommand(
    params: AddTimelineItemOperation['params'],
  ): AddTimelineItemCommand {
    // 将时间码转换为帧数
    const positionFrames = timecodeToFrames(params.position)

    // 获取对应的MediaItem
    const mediaItem = unifiedStore.getMediaItem(params.mediaItemId)
    if (!mediaItem) {
      throw new Error(`找不到对应的素材项目: ${params.mediaItemId}`)
    }

    // 检查素材状态和错误条件
    const hasError = UnifiedMediaItemQueries.hasAnyError(mediaItem)
    if (hasError) {
      throw new Error('素材解析失败，无法添加到时间轴')
    }

    // 检查媒体类型是否已知 - 阻止未知类型素材创建时间轴项目
    if (UnifiedMediaItemQueries.isUnknownType(mediaItem)) {
      throw new Error('素材类型未确定，请等待检测完成')
    }

    // 检查是否有可用的时长信息
    const availableDuration = mediaItem.duration
    if (!availableDuration || availableDuration <= 0) {
      throw new Error('素材时长信息不可用，请等待解析完成')
    }

    // 现在 mediaType 已经确定不是 'unknown'，可以安全地转换为 MediaType
    const knownMediaType = mediaItem.mediaType as MediaType

    // 根据素材状态确定时间轴项目状态
    const isReady = UnifiedMediaItemQueries.isReady(mediaItem)
    const timelineStatus: 'ready' | 'loading' = isReady ? 'ready' : 'loading'

    // 获取媒体的原始分辨率（仅对视觉媒体有效）- 使用 unifiedStore 的方法
    let originalResolution: { width: number; height: number } | null = null
    if (UnifiedMediaItemQueries.isVideo(mediaItem)) {
      originalResolution = unifiedStore.getVideoOriginalResolution(params.mediaItemId) || null
    } else if (UnifiedMediaItemQueries.isImage(mediaItem)) {
      originalResolution = unifiedStore.getImageOriginalResolution(params.mediaItemId) || null
    }

    // 创建增强的默认配置
    const config = createEnhancedDefaultConfig(knownMediaType, originalResolution)

    // 创建时间轴项目数据 - 与 createMediaClipFromMediaItem 对齐
    const timelineItemData = {
      id: generateId(),
      mediaItemId: params.mediaItemId,
      trackId: params.trackId,
      mediaType: knownMediaType,
      timeRange: {
        timelineStartTime: positionFrames,
        timelineEndTime: positionFrames + availableDuration, // 使用素材的实际时长
        clipStartTime: 0,
        clipEndTime: availableDuration,
      },
      config: config,
      animation: undefined, // 新创建的项目默认没有动画
      timelineStatus: timelineStatus,
      runtime: {}, // 添加必需的 runtime 字段
    }

    return new AddTimelineItemCommand(
      timelineItemData,
      unifiedTimelineModule,
      unifiedWebavModule,
      unifiedMediaModule,
      unifiedConfigModule,
    )
  }

  return {
    buildOperations,
    createCommandFromOperation,
    createAddTimelineItemCommand,
  }
}
