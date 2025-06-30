/**
 * 关键帧操作命令类
 * 为关键帧系统提供撤销/重做支持
 */

import type {
  SimpleCommand,
  TimelineItem,
  Keyframe,
  AnimationConfig,
  MediaType,
  GetMediaConfig
} from '../../../types'
import { generateCommandId } from '../../../utils/idGenerator'

// ==================== 关键帧数据快照接口（重构版本） ====================

/**
 * 关键帧状态快照（重构版本）
 * 用于保存和恢复关键帧的完整状态，支持泛型
 */
interface KeyframeSnapshot<T extends MediaType = MediaType> {
  /** 动画配置的完整快照 */
  animationConfig: AnimationConfig<T> | null
  /** 时间轴项目的配置快照 */
  itemProperties: GetMediaConfig<T>
}

// ==================== 创建关键帧命令 ====================

/**
 * 创建关键帧命令（重构版本）
 * 支持在指定帧位置创建包含所有属性的关键帧，支持泛型
 */
export class CreateKeyframeCommand<T extends MediaType = MediaType> implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private beforeSnapshot: KeyframeSnapshot<T>
  private afterSnapshot: KeyframeSnapshot<T> | null = null

  constructor(
    private timelineItemId: string,
    private frame: number,
    private timelineModule: {
      getTimelineItem: (id: string) => TimelineItem<T> | undefined
    },
    private webavAnimationManager: {
      updateWebAVAnimation: (item: TimelineItem<T>) => Promise<void>
    },
    private playbackControls?: {
      seekTo: (frame: number) => void
    },
  ) {
    this.id = generateCommandId()
    this.description = `创建关键帧 (帧 ${frame})`

    // 保存执行前的状态快照
    const item = this.timelineModule.getTimelineItem(timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${timelineItemId}`)
    }
    this.beforeSnapshot = this.createSnapshot(item)
  }

  /**
   * 创建状态快照（重构版本）
   */
  private createSnapshot(item: TimelineItem<T>): KeyframeSnapshot<T> {
    return {
      animationConfig: item.config.animation || null,
      itemProperties: { ...item.config } as GetMediaConfig<T>,
    }
  }

  /**
   * 应用状态快照（重构版本）
   */
  private async applySnapshot(item: TimelineItem<T>, snapshot: KeyframeSnapshot<T>): Promise<void> {
    console.log('🔧 [Keyframe Command] Applying snapshot:', {
      itemId: item.id,
      hasAnimationBefore: !!(item.config.animation && item.config.animation.isEnabled),
      hasAnimationAfter: !!(snapshot.animationConfig && snapshot.animationConfig.isEnabled),
      keyframeCount: snapshot.animationConfig?.keyframes?.length || 0,
    })

    // 恢复动画配置
    item.config.animation = snapshot.animationConfig || undefined

    // 恢复项目配置属性（排除animation属性避免覆盖）
    const { animation, ...otherProperties } = snapshot.itemProperties as any
    Object.assign(item.config, otherProperties)

    // 🔧 修复：先强制更新WebAV动画，确保关键帧数据正确应用
    await this.webavAnimationManager.updateWebAVAnimation(item)

    // 🔧 修复：根据动画状态选择正确的数据流向
    if (!item.config.animation || !item.config.animation.isEnabled) {
      // 没有动画：使用正确的数据流向同步属性到sprite
      await this.syncPropertiesToSpriteWithCorrectDataFlow(item)
    } else {
      // 有动画：确保WebAV动画系统更新到当前帧的正确状态
      await this.ensureAnimationCurrentFrameSync(item)

      // 🔧 额外修复：强制触发一次画布重新渲染，确保位置更新生效
      await this.forceCanvasUpdate()
    }

    console.log('🔧 [Keyframe Command] Snapshot applied successfully')
  }

  /**
   * 使用正确的数据流向同步属性到sprite
   */
  private async syncPropertiesToSpriteWithCorrectDataFlow(item: TimelineItem<T>): Promise<void> {
    try {
      const { useVideoStore } = await import('../../../stores/videoStore')
      const videoStore = useVideoStore()

      const config = item.config as any
      const transform: any = {}

      // 构建需要同步的属性
      if (item.mediaType === 'video' || item.mediaType === 'image') {
        if (config.x !== undefined) transform.x = config.x
        if (config.y !== undefined) transform.y = config.y
        if (config.width !== undefined) transform.width = config.width
        if (config.height !== undefined) transform.height = config.height
        if (config.rotation !== undefined) transform.rotation = config.rotation
        if (config.opacity !== undefined) transform.opacity = config.opacity
      }
      if (config.zIndex !== undefined) transform.zIndex = config.zIndex

      // 使用正确的数据流向：通过updateTimelineItemTransform更新sprite
      // 这会触发propsChange事件，保持数据流向的一致性
      if (Object.keys(transform).length > 0) {
        videoStore.updateTimelineItemTransform(item.id, transform)
      }

      console.log('🔧 [Keyframe Command] Synced properties using correct data flow:', {
        itemId: item.id,
        transform,
      })
    } catch (error) {
      console.error('🔧 [Keyframe Command] Failed to sync properties:', error)
    }
  }

  /**
   * 确保有动画时WebAV动画系统正确更新
   */
  private async ensureAnimationCurrentFrameSync(item: TimelineItem<T>): Promise<void> {
    try {
      // 动态导入所需模块
      const { useVideoStore } = await import('../../../stores/videoStore')
      const { useWebAVControls } = await import('../../../composables/useWebAVControls')

      const videoStore = useVideoStore()
      const webAVControls = useWebAVControls()
      const currentFrame = videoStore.currentFrame

      // 🔧 修复：有动画时只需要触发画布重新渲染
      // WebAV动画系统会自动根据关键帧数据计算当前帧的显示
      // 不需要手动插值计算TimelineItem.config的属性值
      const avCanvas = webAVControls.getAVCanvas()
      if (avCanvas) {
        const currentTime = currentFrame * (1000000 / 30)
        avCanvas.previewFrame(currentTime)
      }

      console.log('🔧 [Keyframe Command] Ensured animation current frame sync:', {
        itemId: item.id,
        currentFrame,
        hasAnimation: !!(item.config.animation && item.config.animation.isEnabled),
      })
    } catch (error) {
      console.error('🔧 [Keyframe Command] Failed to ensure animation current frame sync:', error)
    }
  }

  /**
   * 强制画布更新
   */
  private async forceCanvasUpdate(): Promise<void> {
    try {
      const { useVideoStore } = await import('../../../stores/videoStore')
      const { useWebAVControls } = await import('../../../composables/useWebAVControls')

      const videoStore = useVideoStore()
      const webAVControls = useWebAVControls()
      const avCanvas = webAVControls.getAVCanvas()

      if (avCanvas) {
        const currentTime = videoStore.currentFrame * (1000000 / 30)
        // 强制触发两次渲染，确保动画更新生效
        await avCanvas.previewFrame(currentTime)
        // 稍微延迟后再次触发，确保WebAV内部状态完全更新
        setTimeout(() => {
          avCanvas.previewFrame(currentTime)
        }, 10)

        console.log('🔧 [Keyframe Command] Forced canvas update:', {
          currentFrame: videoStore.currentFrame,
          currentTime,
        })
      }
    } catch (error) {
      console.error('🔧 [Keyframe Command] Failed to force canvas update:', error)
    }
  }

  /**
   * 执行命令：创建关键帧
   */
  async execute(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
    }

    // 检查播放头是否在clip时间范围内
    const { isPlayheadInTimelineItem } = await import('../../utils/timelineSearchUtils')
    if (!isPlayheadInTimelineItem(item, this.frame)) {
      // 使用通知系统显示用户友好的警告
      const { useVideoStore } = await import('../../../stores/videoStore')
      const videoStore = useVideoStore()

      videoStore.showWarning(
        '无法创建关键帧',
        '播放头不在当前视频片段的时间范围内。请将播放头移动到片段内再尝试创建关键帧。',
      )

      console.warn('🎬 [Create Keyframe Command] 播放头不在当前clip时间范围内，无法创建关键帧:', {
        itemId: this.timelineItemId,
        frame: this.frame,
        clipTimeRange: {
          start: item.timeRange.timelineStartTime,
          end: item.timeRange.timelineEndTime,
        },
      })
      throw new Error('播放头不在当前clip时间范围内，无法创建关键帧')
    }

    try {
      // 动态导入关键帧工具函数
      const { createKeyframe, enableAnimation, initializeAnimation } = await import(
        '../../../utils/unifiedKeyframeUtils'
      )

      // 1. 确保动画已启用（重构版本）
      if (!item.config.animation) {
        initializeAnimation(item)
      }
      enableAnimation(item)

      // 2. 创建关键帧
      const keyframe = createKeyframe(item, this.frame)
      item.config.animation!.keyframes.push(keyframe)

      // 3. 排序关键帧
      const { sortKeyframes } = await import('../../../utils/unifiedKeyframeUtils')
      sortKeyframes(item)

      // 4. 更新WebAV动画
      await this.webavAnimationManager.updateWebAVAnimation(item)

      // 5. 保存执行后的状态快照
      this.afterSnapshot = this.createSnapshot(item)

      // 6. 重做关键帧操作时，跳转到相关帧位置
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.frame)
      }

      console.log('✅ 创建关键帧命令执行成功:', {
        itemId: this.timelineItemId,
        frame: this.frame,
        keyframe,
      })
    } catch (error) {
      console.error('❌ 创建关键帧命令执行失败:', error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复到创建前的状态
   */
  async undo(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
    }

    try {
      await this.applySnapshot(item, this.beforeSnapshot)

      // 撤销关键帧操作时，跳转到相关帧位置
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.frame)
      }

      console.log('↩️ 创建关键帧命令撤销成功:', {
        itemId: this.timelineItemId,
        frame: this.frame,
      })
    } catch (error) {
      console.error('❌ 创建关键帧命令撤销失败:', error)
      throw error
    }
  }
}

// ==================== 删除关键帧命令 ====================

/**
 * 删除关键帧命令（重构版本）
 * 支持删除指定帧位置的关键帧，支持泛型
 */
export class DeleteKeyframeCommand<T extends MediaType = MediaType> implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private beforeSnapshot: KeyframeSnapshot<T>
  private afterSnapshot: KeyframeSnapshot<T> | null = null

  constructor(
    private timelineItemId: string,
    private frame: number,
    private timelineModule: {
      getTimelineItem: (id: string) => TimelineItem<T> | undefined
    },
    private webavAnimationManager: {
      updateWebAVAnimation: (item: TimelineItem<T>) => Promise<void>
    },
    private playbackControls?: {
      seekTo: (frame: number) => void
    },
  ) {
    this.id = generateCommandId()
    this.description = `删除关键帧 (帧 ${frame})`

    // 保存执行前的状态快照
    const item = this.timelineModule.getTimelineItem(timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${timelineItemId}`)
    }
    this.beforeSnapshot = this.createSnapshot(item)
  }

  /**
   * 创建状态快照（重构版本）
   */
  private createSnapshot(item: TimelineItem<T>): KeyframeSnapshot<T> {
    return {
      animationConfig: item.config.animation || null,
      itemProperties: { ...item.config } as GetMediaConfig<T>,
    }
  }

  /**
   * 应用状态快照（重构版本）
   */
  private async applySnapshot(item: TimelineItem<T>, snapshot: KeyframeSnapshot<T>): Promise<void> {
    console.log('🔧 [Keyframe Command] Applying snapshot:', {
      itemId: item.id,
      hasAnimationBefore: !!(item.config.animation && item.config.animation.isEnabled),
      hasAnimationAfter: !!(snapshot.animationConfig && snapshot.animationConfig.isEnabled),
      keyframeCount: snapshot.animationConfig?.keyframes?.length || 0,
    })

    // 恢复动画配置
    item.config.animation = snapshot.animationConfig || undefined

    // 恢复项目配置属性（排除animation属性避免覆盖）
    const { animation, ...otherProperties } = snapshot.itemProperties as any
    Object.assign(item.config, otherProperties)

    // 🔧 修复：先强制更新WebAV动画，确保关键帧数据正确应用
    await this.webavAnimationManager.updateWebAVAnimation(item)

    // 🔧 修复：根据动画状态选择正确的数据流向
    if (!item.config.animation || !item.config.animation.isEnabled) {
      // 没有动画：使用正确的数据流向同步属性到sprite
      await this.syncPropertiesToSpriteWithCorrectDataFlow(item)
    } else {
      // 有动画：确保WebAV动画系统更新到当前帧的正确状态
      await this.ensureAnimationCurrentFrameSync(item)

      // 🔧 额外修复：强制触发一次画布重新渲染，确保位置更新生效
      await this.forceCanvasUpdate()
    }

    console.log('🔧 [Keyframe Command] Snapshot applied successfully')
  }

  /**
   * 使用正确的数据流向同步属性到sprite
   */
  private async syncPropertiesToSpriteWithCorrectDataFlow(item: TimelineItem<T>): Promise<void> {
    try {
      const { useVideoStore } = await import('../../../stores/videoStore')
      const videoStore = useVideoStore()

      const config = item.config as any
      const transform: any = {}

      // 构建需要同步的属性
      if (item.mediaType === 'video' || item.mediaType === 'image') {
        if (config.x !== undefined) transform.x = config.x
        if (config.y !== undefined) transform.y = config.y
        if (config.width !== undefined) transform.width = config.width
        if (config.height !== undefined) transform.height = config.height
        if (config.rotation !== undefined) transform.rotation = config.rotation
        if (config.opacity !== undefined) transform.opacity = config.opacity
      }
      if (config.zIndex !== undefined) transform.zIndex = config.zIndex

      // 使用正确的数据流向：通过updateTimelineItemTransform更新sprite
      // 这会触发propsChange事件，保持数据流向的一致性
      if (Object.keys(transform).length > 0) {
        videoStore.updateTimelineItemTransform(item.id, transform)
      }

      console.log('🔧 [Keyframe Command] Synced properties using correct data flow:', {
        itemId: item.id,
        transform,
      })
    } catch (error) {
      console.error('🔧 [Keyframe Command] Failed to sync properties:', error)
    }
  }

  /**
   * 确保有动画时WebAV动画系统正确更新
   */
  private async ensureAnimationCurrentFrameSync(item: TimelineItem<T>): Promise<void> {
    try {
      // 动态导入所需模块
      const { useVideoStore } = await import('../../../stores/videoStore')
      const { useWebAVControls } = await import('../../../composables/useWebAVControls')

      const videoStore = useVideoStore()
      const webAVControls = useWebAVControls()
      const currentFrame = videoStore.currentFrame

      // 🔧 修复：有动画时只需要触发画布重新渲染
      // WebAV动画系统会自动根据关键帧数据计算当前帧的显示
      // 不需要手动插值计算TimelineItem.config的属性值
      const avCanvas = webAVControls.getAVCanvas()
      if (avCanvas) {
        const currentTime = currentFrame * (1000000 / 30)
        avCanvas.previewFrame(currentTime)
      }

      console.log('🔧 [Keyframe Command] Ensured animation current frame sync:', {
        itemId: item.id,
        currentFrame,
        hasAnimation: !!(item.config.animation && item.config.animation.isEnabled),
      })
    } catch (error) {
      console.error('🔧 [Keyframe Command] Failed to ensure animation current frame sync:', error)
    }
  }

  /**
   * 强制画布更新
   */
  private async forceCanvasUpdate(): Promise<void> {
    try {
      const { useVideoStore } = await import('../../../stores/videoStore')
      const { useWebAVControls } = await import('../../../composables/useWebAVControls')

      const videoStore = useVideoStore()
      const webAVControls = useWebAVControls()
      const avCanvas = webAVControls.getAVCanvas()

      if (avCanvas) {
        const currentTime = videoStore.currentFrame * (1000000 / 30)
        // 强制触发两次渲染，确保动画更新生效
        await avCanvas.previewFrame(currentTime)
        // 稍微延迟后再次触发，确保WebAV内部状态完全更新
        setTimeout(() => {
          avCanvas.previewFrame(currentTime)
        }, 10)

        console.log('🔧 [Keyframe Command] Forced canvas update:', {
          currentFrame: videoStore.currentFrame,
          currentTime,
        })
      }
    } catch (error) {
      console.error('🔧 [Keyframe Command] Failed to force canvas update:', error)
    }
  }

  /**
   * 执行命令：删除关键帧
   */
  async execute(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
    }

    // 检查播放头是否在clip时间范围内
    const { isPlayheadInTimelineItem } = await import('../../utils/timelineSearchUtils')
    if (!isPlayheadInTimelineItem(item, this.frame)) {
      // 使用通知系统显示用户友好的警告
      const { useVideoStore } = await import('../../../stores/videoStore')
      const videoStore = useVideoStore()

      videoStore.showWarning(
        '无法删除关键帧',
        '播放头不在当前视频片段的时间范围内。请将播放头移动到片段内再尝试删除关键帧。',
      )

      console.warn('🎬 [Delete Keyframe Command] 播放头不在当前clip时间范围内，无法删除关键帧:', {
        itemId: this.timelineItemId,
        frame: this.frame,
        clipTimeRange: {
          start: item.timeRange.timelineStartTime,
          end: item.timeRange.timelineEndTime,
        },
      })
      throw new Error('播放头不在当前clip时间范围内，无法删除关键帧')
    }

    try {
      // 动态导入关键帧工具函数
      const { removeKeyframeAtFrame, disableAnimation } = await import(
        '../../../utils/unifiedKeyframeUtils'
      )

      // 1. 删除指定帧的关键帧
      removeKeyframeAtFrame(item, this.frame)

      // 2. 如果没有其他关键帧，禁用动画（重构版本）
      if (!item.config.animation || item.config.animation.keyframes.length === 0) {
        disableAnimation(item)
      }

      // 3. 更新WebAV动画
      await this.webavAnimationManager.updateWebAVAnimation(item)

      // 4. 保存执行后的状态快照
      this.afterSnapshot = this.createSnapshot(item)

      // 5. 重做关键帧操作时，跳转到相关帧位置
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.frame)
      }

      console.log('✅ 删除关键帧命令执行成功:', {
        itemId: this.timelineItemId,
        frame: this.frame,
      })
    } catch (error) {
      console.error('❌ 删除关键帧命令执行失败:', error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复到删除前的状态
   */
  async undo(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
    }

    try {
      await this.applySnapshot(item, this.beforeSnapshot)

      // 撤销关键帧操作时，跳转到相关帧位置
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.frame)
      }

      console.log('↩️ 删除关键帧命令撤销成功:', {
        itemId: this.timelineItemId,
        frame: this.frame,
      })
    } catch (error) {
      console.error('❌ 删除关键帧命令撤销失败:', error)
      throw error
    }
  }
}

// ==================== 更新关键帧属性命令 ====================

/**
 * 更新时间轴项目属性命令（重构版本）
 * 智能处理属性更新：根据当前状态决定是否创建/更新关键帧，支持泛型
 */
export class UpdateTimelineItemPropertyCommand<T extends MediaType = MediaType> implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private beforeSnapshot: KeyframeSnapshot<T>
  private afterSnapshot: KeyframeSnapshot<T> | null = null

  constructor(
    private timelineItemId: string,
    private frame: number,
    private property: string,
    private newValue: any,
    private timelineModule: {
      getTimelineItem: (id: string) => TimelineItem<T> | undefined
    },
    private webavAnimationManager: {
      updateWebAVAnimation: (item: TimelineItem<T>) => Promise<void>
    },
    private playbackControls?: {
      seekTo: (frame: number) => void
    },
  ) {
    this.id = generateCommandId()
    this.description = `修改属性: ${property} (帧 ${frame})`

    // 保存执行前的状态快照
    const item = this.timelineModule.getTimelineItem(timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${timelineItemId}`)
    }
    this.beforeSnapshot = this.createSnapshot(item)
  }

  /**
   * 创建状态快照（重构版本）
   */
  private createSnapshot(item: TimelineItem<T>): KeyframeSnapshot<T> {
    return {
      animationConfig: item.config.animation || null,
      itemProperties: { ...item.config } as GetMediaConfig<T>,
    }
  }

  /**
   * 应用状态快照（重构版本）
   */
  private async applySnapshot(item: TimelineItem<T>, snapshot: KeyframeSnapshot<T>): Promise<void> {
    console.log('🔧 [Keyframe Command] Applying snapshot:', {
      itemId: item.id,
      hasAnimationBefore: !!(item.config.animation && item.config.animation.isEnabled),
      hasAnimationAfter: !!(snapshot.animationConfig && snapshot.animationConfig.isEnabled),
      keyframeCount: snapshot.animationConfig?.keyframes?.length || 0,
    })

    // 恢复动画配置
    item.config.animation = snapshot.animationConfig || undefined

    // 恢复项目配置属性（排除animation属性避免覆盖）
    const { animation, ...otherProperties } = snapshot.itemProperties as any
    Object.assign(item.config, otherProperties)

    // 🔧 修复：先强制更新WebAV动画，确保关键帧数据正确应用
    await this.webavAnimationManager.updateWebAVAnimation(item)

    // 🔧 修复：根据动画状态选择正确的数据流向
    if (!item.config.animation || !item.config.animation.isEnabled) {
      // 没有动画：使用正确的数据流向同步属性到sprite
      await this.syncPropertiesToSpriteWithCorrectDataFlow(item)
    } else {
      // 有动画：确保WebAV动画系统更新到当前帧的正确状态
      await this.ensureAnimationCurrentFrameSync(item)

      // 🔧 额外修复：强制触发一次画布重新渲染，确保位置更新生效
      await this.forceCanvasUpdate()
    }

    console.log('🔧 [Keyframe Command] Snapshot applied successfully')
  }

  /**
   * 使用正确的数据流向同步属性到sprite
   */
  private async syncPropertiesToSpriteWithCorrectDataFlow(item: TimelineItem<T>): Promise<void> {
    try {
      const { useVideoStore } = await import('../../../stores/videoStore')
      const videoStore = useVideoStore()

      const config = item.config as any
      const transform: any = {}

      // 构建需要同步的属性
      if (item.mediaType === 'video' || item.mediaType === 'image') {
        if (config.x !== undefined) transform.x = config.x
        if (config.y !== undefined) transform.y = config.y
        if (config.width !== undefined) transform.width = config.width
        if (config.height !== undefined) transform.height = config.height
        if (config.rotation !== undefined) transform.rotation = config.rotation
        if (config.opacity !== undefined) transform.opacity = config.opacity
      }
      if (config.zIndex !== undefined) transform.zIndex = config.zIndex

      // 使用正确的数据流向：通过updateTimelineItemTransform更新sprite
      // 这会触发propsChange事件，保持数据流向的一致性
      if (Object.keys(transform).length > 0) {
        videoStore.updateTimelineItemTransform(item.id, transform)
      }

      console.log('🔧 [Keyframe Command] Synced properties using correct data flow:', {
        itemId: item.id,
        transform,
      })
    } catch (error) {
      console.error('🔧 [Keyframe Command] Failed to sync properties:', error)
    }
  }

  /**
   * 确保有动画时WebAV动画系统正确更新
   */
  private async ensureAnimationCurrentFrameSync(item: TimelineItem<T>): Promise<void> {
    try {
      // 动态导入所需模块
      const { useVideoStore } = await import('../../../stores/videoStore')
      const { useWebAVControls } = await import('../../../composables/useWebAVControls')

      const videoStore = useVideoStore()
      const webAVControls = useWebAVControls()
      const currentFrame = videoStore.currentFrame

      // 🔧 修复：有动画时只需要触发画布重新渲染
      // WebAV动画系统会自动根据关键帧数据计算当前帧的显示
      // 不需要手动插值计算TimelineItem.config的属性值
      const avCanvas = webAVControls.getAVCanvas()
      if (avCanvas) {
        const currentTime = currentFrame * (1000000 / 30)
        avCanvas.previewFrame(currentTime)
      }

      console.log('🔧 [Keyframe Command] Ensured animation current frame sync:', {
        itemId: item.id,
        currentFrame,
        hasAnimation: !!(item.config.animation && item.config.animation.isEnabled),
      })
    } catch (error) {
      console.error('🔧 [Keyframe Command] Failed to ensure animation current frame sync:', error)
    }
  }

  /**
   * 强制画布更新
   */
  private async forceCanvasUpdate(): Promise<void> {
    try {
      const { useVideoStore } = await import('../../../stores/videoStore')
      const { useWebAVControls } = await import('../../../composables/useWebAVControls')

      const videoStore = useVideoStore()
      const webAVControls = useWebAVControls()
      const avCanvas = webAVControls.getAVCanvas()

      if (avCanvas) {
        const currentTime = videoStore.currentFrame * (1000000 / 30)
        // 强制触发两次渲染，确保动画更新生效
        await avCanvas.previewFrame(currentTime)
        // 稍微延迟后再次触发，确保WebAV内部状态完全更新
        setTimeout(() => {
          avCanvas.previewFrame(currentTime)
        }, 10)

        console.log('🔧 [Keyframe Command] Forced canvas update:', {
          currentFrame: videoStore.currentFrame,
          currentTime,
        })
      }
    } catch (error) {
      console.error('🔧 [Keyframe Command] Failed to force canvas update:', error)
    }
  }

  /**
   * 执行命令：智能更新时间轴项目属性
   */
  async execute(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
    }

    // 检查播放头是否在clip时间范围内
    const { isPlayheadInTimelineItem } = await import('../../utils/timelineSearchUtils')
    if (!isPlayheadInTimelineItem(item, this.frame)) {
      // 使用通知系统显示用户友好的警告
      const { useVideoStore } = await import('../../../stores/videoStore')
      const videoStore = useVideoStore()

      videoStore.showWarning(
        '无法更新属性',
        '播放头不在当前视频片段的时间范围内。请将播放头移动到片段内再尝试修改属性。',
      )

      console.warn(
        '🎬 [Update Timeline Item Property Command] 播放头不在当前clip时间范围内，无法更新属性:',
        {
          itemId: this.timelineItemId,
          frame: this.frame,
          property: this.property,
          value: this.newValue,
          clipTimeRange: {
            start: item.timeRange.timelineStartTime,
            end: item.timeRange.timelineEndTime,
          },
        },
      )
      throw new Error('播放头不在当前clip时间范围内，无法更新属性')
    }

    try {
      // 动态导入关键帧工具函数
      const { handlePropertyChange } = await import('../../../utils/unifiedKeyframeUtils')

      // 使用统一的属性修改处理逻辑
      handlePropertyChange(item, this.frame, this.property, this.newValue)

      // 更新WebAV动画
      await this.webavAnimationManager.updateWebAVAnimation(item)

      // 保存执行后的状态快照
      this.afterSnapshot = this.createSnapshot(item)

      // 重做关键帧属性修改时，跳转到相关帧位置
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.frame)
      }

      console.log('✅ 更新时间轴项目属性命令执行成功:', {
        itemId: this.timelineItemId,
        frame: this.frame,
        property: this.property,
        value: this.newValue,
      })
    } catch (error) {
      console.error('❌ 更新时间轴项目属性命令执行失败:', error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复到修改前的状态
   */
  async undo(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
    }

    try {
      await this.applySnapshot(item, this.beforeSnapshot)

      // 撤销关键帧属性修改时，跳转到相关帧位置
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.frame)
      }

      console.log('↩️ 更新时间轴项目属性命令撤销成功:', {
        itemId: this.timelineItemId,
        frame: this.frame,
        property: this.property,
      })
    } catch (error) {
      console.error('❌ 更新时间轴项目属性命令撤销失败:', error)
      throw error
    }
  }
}

// ==================== 清除所有关键帧命令 ====================

/**
 * 清除所有关键帧命令（重构版本）
 * 支持清除时间轴项目的所有关键帧并禁用动画，支持泛型
 */
export class ClearAllKeyframesCommand<T extends MediaType = MediaType> implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private beforeSnapshot: KeyframeSnapshot<T>
  private afterSnapshot: KeyframeSnapshot<T> | null = null

  constructor(
    private timelineItemId: string,
    private timelineModule: {
      getTimelineItem: (id: string) => TimelineItem<T> | undefined
    },
    private webavAnimationManager: {
      updateWebAVAnimation: (item: TimelineItem<T>) => Promise<void>
    },
    private playbackControls?: {
      seekTo: (frame: number) => void
    },
  ) {
    this.id = generateCommandId()
    this.description = `清除所有关键帧`

    // 保存执行前的状态快照
    const item = this.timelineModule.getTimelineItem(timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${timelineItemId}`)
    }
    this.beforeSnapshot = this.createSnapshot(item)
  }

  /**
   * 创建状态快照（重构版本）
   */
  private createSnapshot(item: TimelineItem<T>): KeyframeSnapshot<T> {
    return {
      animationConfig: item.config.animation || null,
      itemProperties: { ...item.config } as GetMediaConfig<T>,
    }
  }

  /**
   * 应用状态快照（重构版本）
   */
  private async applySnapshot(item: TimelineItem<T>, snapshot: KeyframeSnapshot<T>): Promise<void> {
    // 恢复动画配置
    item.config.animation = snapshot.animationConfig || undefined

    // 恢复项目配置属性（排除animation属性避免覆盖）
    const { animation, ...otherProperties } = snapshot.itemProperties as any
    Object.assign(item.config, otherProperties)

    // 更新WebAV动画
    await this.webavAnimationManager.updateWebAVAnimation(item)

    // 🔧 修复：根据动画状态选择正确的数据流向
    if (!item.config.animation || !item.config.animation.isEnabled) {
      // 没有动画：使用正确的数据流向同步属性到sprite
      await this.syncPropertiesToSpriteWithCorrectDataFlow(item)
    } else {
      // 有动画：确保WebAV动画系统更新到当前帧的正确状态
      await this.ensureAnimationCurrentFrameSync(item)
    }
  }

  /**
   * 使用正确的数据流向同步属性到sprite
   */
  private async syncPropertiesToSpriteWithCorrectDataFlow(item: TimelineItem<T>): Promise<void> {
    try {
      const { useVideoStore } = await import('../../../stores/videoStore')
      const videoStore = useVideoStore()

      const config = item.config as any
      const transform: any = {}

      // 构建需要同步的属性
      if (item.mediaType === 'video' || item.mediaType === 'image') {
        if (config.x !== undefined) transform.x = config.x
        if (config.y !== undefined) transform.y = config.y
        if (config.width !== undefined) transform.width = config.width
        if (config.height !== undefined) transform.height = config.height
        if (config.rotation !== undefined) transform.rotation = config.rotation
        if (config.opacity !== undefined) transform.opacity = config.opacity
      }
      if (config.zIndex !== undefined) transform.zIndex = config.zIndex

      // 使用正确的数据流向：通过updateTimelineItemTransform更新sprite
      // 这会触发propsChange事件，保持数据流向的一致性
      if (Object.keys(transform).length > 0) {
        videoStore.updateTimelineItemTransform(item.id, transform)
      }

      console.log('🔧 [Keyframe Command] Synced properties using correct data flow:', {
        itemId: item.id,
        transform,
      })
    } catch (error) {
      console.error('🔧 [Keyframe Command] Failed to sync properties:', error)
    }
  }

  /**
   * 确保有动画时WebAV动画系统正确更新
   */
  private async ensureAnimationCurrentFrameSync(item: TimelineItem<T>): Promise<void> {
    try {
      // 动态导入所需模块
      const { useVideoStore } = await import('../../../stores/videoStore')
      const { useWebAVControls } = await import('../../../composables/useWebAVControls')

      const videoStore = useVideoStore()
      const webAVControls = useWebAVControls()
      const currentFrame = videoStore.currentFrame

      // 🔧 修复：有动画时只需要触发画布重新渲染
      // WebAV动画系统会自动根据关键帧数据计算当前帧的显示
      // 不需要手动插值计算TimelineItem.config的属性值
      const avCanvas = webAVControls.getAVCanvas()
      if (avCanvas) {
        const currentTime = currentFrame * (1000000 / 30)
        avCanvas.previewFrame(currentTime)
      }

      console.log('🔧 [Keyframe Command] Ensured animation current frame sync:', {
        itemId: item.id,
        currentFrame,
        hasAnimation: !!(item.config.animation && item.config.animation.isEnabled),
      })
    } catch (error) {
      console.error('🔧 [Keyframe Command] Failed to ensure animation current frame sync:', error)
    }
  }

  /**
   * 强制画布更新
   */
  private async forceCanvasUpdate(): Promise<void> {
    try {
      const { useVideoStore } = await import('../../../stores/videoStore')
      const { useWebAVControls } = await import('../../../composables/useWebAVControls')

      const videoStore = useVideoStore()
      const webAVControls = useWebAVControls()
      const avCanvas = webAVControls.getAVCanvas()

      if (avCanvas) {
        const currentTime = videoStore.currentFrame * (1000000 / 30)
        // 强制触发两次渲染，确保动画更新生效
        await avCanvas.previewFrame(currentTime)
        // 稍微延迟后再次触发，确保WebAV内部状态完全更新
        setTimeout(() => {
          avCanvas.previewFrame(currentTime)
        }, 10)

        console.log('🔧 [Keyframe Command] Forced canvas update:', {
          currentFrame: videoStore.currentFrame,
          currentTime,
        })
      }
    } catch (error) {
      console.error('🔧 [Keyframe Command] Failed to force canvas update:', error)
    }
  }

  /**
   * 执行命令：清除所有关键帧
   */
  async execute(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
    }

    try {
      // 动态导入关键帧工具函数
      const { clearAllKeyframes } = await import('../../../utils/unifiedKeyframeUtils')

      // 清除所有关键帧
      clearAllKeyframes(item)

      // 更新WebAV动画
      await this.webavAnimationManager.updateWebAVAnimation(item)

      // 保存执行后的状态快照
      this.afterSnapshot = this.createSnapshot(item)

      // 重做清除关键帧操作时，跳转到时间轴项目的开始位置
      if (this.playbackControls && item.timeRange) {
        this.playbackControls.seekTo(item.timeRange.timelineStartTime)
      }

      console.log('✅ 清除所有关键帧命令执行成功:', {
        itemId: this.timelineItemId,
      })
    } catch (error) {
      console.error('❌ 清除所有关键帧命令执行失败:', error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复到清除前的状态
   */
  async undo(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
    }

    try {
      await this.applySnapshot(item, this.beforeSnapshot)

      // 撤销清除关键帧操作时，跳转到第一个关键帧位置
      if (this.playbackControls && this.beforeSnapshot.animationConfig?.keyframes?.length) {
        const firstKeyframe = this.beforeSnapshot.animationConfig.keyframes[0]
        if (firstKeyframe && item.timeRange) {
          // 将帧位置转换为绝对帧数
          const { relativeFrameToAbsoluteFrame } = await import(
            '../../../utils/unifiedKeyframeUtils'
          )
          const absoluteFrame = relativeFrameToAbsoluteFrame(
            firstKeyframe.framePosition,
            item.timeRange,
          )
          this.playbackControls.seekTo(absoluteFrame)
        }
      }

      console.log('↩️ 清除所有关键帧命令撤销成功:', {
        itemId: this.timelineItemId,
      })
    } catch (error) {
      console.error('❌ 清除所有关键帧命令撤销失败:', error)
      throw error
    }
  }
}

// ==================== 切换关键帧命令 ====================

/**
 * 切换关键帧命令（重构版本）
 * 根据当前状态智能地创建或删除关键帧，支持泛型
 * 这是最常用的关键帧操作命令，对应关键帧按钮的点击行为
 */
export class ToggleKeyframeCommand<T extends MediaType = MediaType> implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private beforeSnapshot: KeyframeSnapshot<T>
  private afterSnapshot: KeyframeSnapshot<T> | null = null

  constructor(
    private timelineItemId: string,
    private frame: number,
    private timelineModule: {
      getTimelineItem: (id: string) => TimelineItem<T> | undefined
    },
    private webavAnimationManager: {
      updateWebAVAnimation: (item: TimelineItem<T>) => Promise<void>
    },
    private playbackControls?: {
      seekTo: (frame: number) => void
    },
  ) {
    this.id = generateCommandId()
    this.description = `切换关键帧 (帧 ${frame})`

    // 保存执行前的状态快照
    const item = this.timelineModule.getTimelineItem(timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${timelineItemId}`)
    }
    this.beforeSnapshot = this.createSnapshot(item)
  }

  /**
   * 创建状态快照（重构版本）
   */
  private createSnapshot(item: TimelineItem<T>): KeyframeSnapshot<T> {
    return {
      animationConfig: item.config.animation || null,
      itemProperties: { ...item.config } as GetMediaConfig<T>,
    }
  }

  /**
   * 应用状态快照（重构版本）
   */
  private async applySnapshot(item: TimelineItem<T>, snapshot: KeyframeSnapshot<T>): Promise<void> {
    console.log('🔧 [Keyframe Command] Applying snapshot:', {
      itemId: item.id,
      hasAnimationBefore: !!(item.config.animation && item.config.animation.isEnabled),
      hasAnimationAfter: !!(snapshot.animationConfig && snapshot.animationConfig.isEnabled),
      keyframeCount: snapshot.animationConfig?.keyframes?.length || 0,
    })

    // 恢复动画配置
    item.config.animation = snapshot.animationConfig || undefined

    // 恢复项目配置属性（排除animation属性避免覆盖）
    const { animation, ...otherProperties } = snapshot.itemProperties as any
    Object.assign(item.config, otherProperties)

    // 🔧 修复：先强制更新WebAV动画，确保关键帧数据正确应用
    await this.webavAnimationManager.updateWebAVAnimation(item)

    // 🔧 修复：根据动画状态选择正确的数据流向
    if (!item.config.animation || !item.config.animation.isEnabled) {
      // 没有动画：使用正确的数据流向同步属性到sprite
      await this.syncPropertiesToSpriteWithCorrectDataFlow(item)
    } else {
      // 有动画：确保WebAV动画系统更新到当前帧的正确状态
      await this.ensureAnimationCurrentFrameSync(item)

      // 🔧 额外修复：强制触发一次画布重新渲染，确保位置更新生效
      await this.forceCanvasUpdate()
    }

    console.log('🔧 [Keyframe Command] Snapshot applied successfully')
  }

  /**
   * 使用正确的数据流向同步属性到sprite
   */
  private async syncPropertiesToSpriteWithCorrectDataFlow(item: TimelineItem<T>): Promise<void> {
    try {
      const { useVideoStore } = await import('../../../stores/videoStore')
      const videoStore = useVideoStore()

      const config = item.config as any
      const transform: any = {}

      // 构建需要同步的属性
      if (item.mediaType === 'video' || item.mediaType === 'image') {
        if (config.x !== undefined) transform.x = config.x
        if (config.y !== undefined) transform.y = config.y
        if (config.width !== undefined) transform.width = config.width
        if (config.height !== undefined) transform.height = config.height
        if (config.rotation !== undefined) transform.rotation = config.rotation
        if (config.opacity !== undefined) transform.opacity = config.opacity
      }
      if (config.zIndex !== undefined) transform.zIndex = config.zIndex

      // 使用正确的数据流向：通过updateTimelineItemTransform更新sprite
      // 这会触发propsChange事件，保持数据流向的一致性
      if (Object.keys(transform).length > 0) {
        videoStore.updateTimelineItemTransform(item.id, transform)
      }

      console.log('🔧 [Keyframe Command] Synced properties using correct data flow:', {
        itemId: item.id,
        transform,
      })
    } catch (error) {
      console.error('🔧 [Keyframe Command] Failed to sync properties:', error)
    }
  }

  /**
   * 确保有动画时WebAV动画系统正确更新
   */
  private async ensureAnimationCurrentFrameSync(item: TimelineItem<T>): Promise<void> {
    try {
      // 动态导入所需模块
      const { useVideoStore } = await import('../../../stores/videoStore')
      const { useWebAVControls } = await import('../../../composables/useWebAVControls')

      const videoStore = useVideoStore()
      const webAVControls = useWebAVControls()
      const currentFrame = videoStore.currentFrame

      // 🔧 修复：有动画时只需要触发画布重新渲染
      // WebAV动画系统会自动根据关键帧数据计算当前帧的显示
      // 不需要手动插值计算TimelineItem.config的属性值
      const avCanvas = webAVControls.getAVCanvas()
      if (avCanvas) {
        const currentTime = currentFrame * (1000000 / 30)
        avCanvas.previewFrame(currentTime)
      }

      console.log('🔧 [Keyframe Command] Ensured animation current frame sync:', {
        itemId: item.id,
        currentFrame,
        hasAnimation: !!(item.config.animation && item.config.animation.isEnabled),
      })
    } catch (error) {
      console.error('🔧 [Keyframe Command] Failed to ensure animation current frame sync:', error)
    }
  }

  /**
   * 强制画布更新
   */
  private async forceCanvasUpdate(): Promise<void> {
    try {
      const { useVideoStore } = await import('../../../stores/videoStore')
      const { useWebAVControls } = await import('../../../composables/useWebAVControls')

      const videoStore = useVideoStore()
      const webAVControls = useWebAVControls()
      const avCanvas = webAVControls.getAVCanvas()

      if (avCanvas) {
        const currentTime = videoStore.currentFrame * (1000000 / 30)
        // 强制触发两次渲染，确保动画更新生效
        await avCanvas.previewFrame(currentTime)
        // 稍微延迟后再次触发，确保WebAV内部状态完全更新
        setTimeout(() => {
          avCanvas.previewFrame(currentTime)
        }, 10)

        console.log('🔧 [Keyframe Command] Forced canvas update:', {
          currentFrame: videoStore.currentFrame,
          currentTime,
        })
      }
    } catch (error) {
      console.error('🔧 [Keyframe Command] Failed to force canvas update:', error)
    }
  }

  /**
   * 执行命令：切换关键帧
   */
  async execute(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
    }

    // 检查播放头是否在clip时间范围内
    const { isPlayheadInTimelineItem } = await import('../../utils/timelineSearchUtils')
    if (!isPlayheadInTimelineItem(item, this.frame)) {
      // 使用通知系统显示用户友好的警告
      const { useVideoStore } = await import('../../../stores/videoStore')
      const videoStore = useVideoStore()

      videoStore.showWarning(
        '无法切换关键帧',
        '播放头不在当前视频片段的时间范围内。请将播放头移动到片段内再尝试切换关键帧。',
      )

      console.warn('🎬 [Toggle Keyframe Command] 播放头不在当前clip时间范围内，无法切换关键帧:', {
        itemId: this.timelineItemId,
        frame: this.frame,
        clipTimeRange: {
          start: item.timeRange.timelineStartTime,
          end: item.timeRange.timelineEndTime,
        },
      })
      throw new Error('播放头不在当前clip时间范围内，无法切换关键帧')
    }

    try {
      // 动态导入关键帧工具函数
      const { toggleKeyframe } = await import('../../../utils/unifiedKeyframeUtils')

      // 使用统一的关键帧切换逻辑
      toggleKeyframe(item, this.frame)

      // 更新WebAV动画
      await this.webavAnimationManager.updateWebAVAnimation(item)

      // 保存执行后的状态快照
      this.afterSnapshot = this.createSnapshot(item)

      // 重做关键帧切换操作时，跳转到相关帧位置
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.frame)
      }

      console.log('✅ 切换关键帧命令执行成功:', {
        itemId: this.timelineItemId,
        frame: this.frame,
      })
    } catch (error) {
      console.error('❌ 切换关键帧命令执行失败:', error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复到切换前的状态
   */
  async undo(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
    }

    try {
      await this.applySnapshot(item, this.beforeSnapshot)

      // 撤销关键帧切换操作时，跳转到相关帧位置
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.frame)
      }

      console.log('↩️ 切换关键帧命令撤销成功:', {
        itemId: this.timelineItemId,
        frame: this.frame,
      })
    } catch (error) {
      console.error('❌ 切换关键帧命令撤销失败:', error)
      throw error
    }
  }
}
