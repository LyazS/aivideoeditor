import { computed, type Raw } from 'vue'
import { defineStore } from 'pinia'
import { VideoVisibleSprite } from '../utils/VideoVisibleSprite'
import { webavToProjectCoords, projectToWebavCoords } from '../utils/coordinateTransform'
import {
  alignTimeToFrame,
  timeToPixel,
  pixelToTime,
  expandTimelineIfNeeded,
  getTimelineItemAtTime,
  autoArrangeTimelineItems,
  autoArrangeTrackItems,
  calculateTotalDuration,
  findTimelineItemBySprite,
  getTimelineItemsByTrack,
} from './utils/storeUtils'
import { createMediaModule } from './modules/mediaModule'
import { createConfigModule } from './modules/configModule'
import { createTrackModule } from './modules/trackModule'
import { createPlaybackModule } from './modules/playbackModule'
import { createWebAVModule } from './modules/webavModule'
import { createViewportModule } from './modules/viewportModule'
import { createSelectionModule } from './modules/selectionModule'
import { createTimelineModule } from './modules/timelineModule'
import { createClipOperationsModule } from './modules/clipOperationsModule'
import { createHistoryModule } from './modules/historyModule'
import { createNotificationModule } from './modules/notificationModule'
import { AddTimelineItemCommand, RemoveTimelineItemCommand, MoveTimelineItemCommand, UpdateTransformCommand, SplitTimelineItemCommand, DuplicateTimelineItemCommand, AddTrackCommand, RemoveTrackCommand, RenameTrackCommand, ToggleTrackVisibilityCommand, ToggleTrackMuteCommand, ResizeTimelineItemCommand } from './modules/commands/timelineCommands'
import { BatchDeleteCommand, BatchAutoArrangeTrackCommand } from './modules/commands/batchCommands'
import {
  CreateKeyFrameCommand,
  RemoveKeyFrameCommand,
  UpdateKeyFrameCommand,
  ClearAnimationCommand,
  ToggleAnimationCommand,
} from './modules/commands/keyFrameCommands'
import type { MediaItem, TimelineItem } from '../types/videoTypes'
import type { AnimatableProperty } from '../types/animationTypes'
import { getCurrentPropertyValue } from '../utils/animationUtils'
import { KeyFrameAnimationManager } from '../utils/keyFrameAnimationManager'

export const useVideoStore = defineStore('video', () => {
  // 创建媒体管理模块
  const mediaModule = createMediaModule()

  // 创建配置管理模块
  const configModule = createConfigModule()

  // 创建轨道管理模块
  const trackModule = createTrackModule()

  // 创建播放控制模块
  const playbackModule = createPlaybackModule(configModule.frameRate)

  // 创建WebAV集成模块
  const webavModule = createWebAVModule()

  // 🆕 处理sprite属性变化同步的回调函数（先定义占位符）
  let handleSpritePropsChange: (timelineItemId: string, changes: any) => void = () => {
    // 占位符实现，后面会被替换
  }

  // 创建时间轴核心管理模块，传入sprite事件回调
  const timelineModule = createTimelineModule(
    configModule,
    webavModule as any,
    mediaModule,
    trackModule,
    handleSpritePropsChange
  )

  const totalDuration = computed(() => {
    return calculateTotalDuration(
      timelineModule.timelineItems.value,
      configModule.timelineDuration.value,
    )
  })

  // 创建视口管理模块（需要在totalDuration之后创建）
  const viewportModule = createViewportModule(
    timelineModule.timelineItems,
    totalDuration,
    configModule.timelineDuration,
  )

  // 创建通知管理模块
  const notificationModule = createNotificationModule()

  // 创建历史管理模块
  const historyModule = createHistoryModule(notificationModule)

  // 创建选择管理模块（需要在historyModule之后创建）
  const selectionModule = createSelectionModule(
    timelineModule.timelineItems,
    timelineModule.getTimelineItem,
    mediaModule.getMediaItem,
    historyModule.executeCommand
  )

  // 🆕 简化的sprite属性变化回调实现
  const handleSpritePropsChangeImpl = (timelineItemId: string, changes: any): void => {
    // 🆕 如果正在通过关键帧系统更新，跳过处理避免循环
    if (isUpdatingFromKeyFrame) {
      console.log(`🔄 [VideoStore] 跳过sprite props change处理（正在通过关键帧系统更新）`)
      return
    }

    console.log(`🔄 [VideoStore] Handling sprite props change for ${timelineItemId}:`, changes)

    // 找到对应的TimelineItem
    const timelineItem = timelineModule.getTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`TimelineItem not found: ${timelineItemId}`)
      return
    }

    // 🆕 直接更新TimelineItem的属性值
    const sprite = timelineItem.sprite

    // 处理位置和尺寸变化（需要坐标转换）
    if (changes.rect) {
      const rect = sprite.rect
      const projectCoords = webavToProjectCoords(
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        configModule.videoResolution.value.width,
        configModule.videoResolution.value.height
      )

      // 直接更新TimelineItem的响应式属性
      timelineItem.x = projectCoords.x
      timelineItem.y = projectCoords.y
      timelineItem.width = rect.w
      timelineItem.height = rect.h

      if (rect.angle !== undefined) {
        timelineItem.rotation = rect.angle
      }
    }

    // 处理其他属性变化
    if (changes.opacity !== undefined) {
      timelineItem.opacity = sprite.opacity
    }
    if (changes.zIndex !== undefined) {
      timelineItem.zIndex = sprite.zIndex
    }

    // 处理音量相关属性（仅对视频有效）
    if (timelineItem.mediaType === 'video' && sprite instanceof VideoVisibleSprite) {
      if (changes.volume !== undefined) {
        timelineItem.volume = sprite.getVolume()
      }
      if (changes.isMuted !== undefined) {
        timelineItem.isMuted = sprite.isMuted()
      }
    }

    console.log(`✅ [VideoStore] TimelineItem properties updated for ${timelineItemId}`)
  }

  // 🆕 替换占位符函数为实际实现
  handleSpritePropsChange = handleSpritePropsChangeImpl

  // 创建视频片段操作模块（需要在其他模块之后创建）
  const clipOperationsModule = createClipOperationsModule(
    webavModule as any,
    mediaModule,
    timelineModule,
    selectionModule,
    configModule,
    trackModule,
  )

  // ==================== 双向数据同步函数 ====================

  // 🆕 防止循环更新的标志
  let isUpdatingFromKeyFrame = false

  /**
   * 🆕 更新TimelineItem属性到Sprite（UI → Sprite）
   * 这个函数处理从UI输入到Sprite属性的更新
   * 🎬 支持关键帧系统：如果有动画配置，通过关键帧更新；否则直接更新sprite
   */
  function updateTimelineItemProperty(timelineItemId: string, property: string, value: any) {
    const timelineItem = timelineModule.getTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`TimelineItem not found: ${timelineItemId}`)
      return
    }

    // 🎬 检查是否有动画配置，如果有则通过关键帧系统更新
    const hasAnimation = timelineItem.animationConfig !== null

    if (hasAnimation) {
      console.log(`🎬 [VideoStore] 检测到动画clip，通过关键帧系统更新属性: ${property} = ${value}`)

      // 🆕 设置标志防止循环更新
      isUpdatingFromKeyFrame = true

      try {
        // 对于有动画的clip，通过关键帧系统更新
        // 这里需要将属性名映射到AnimatableProperty
        const animatablePropertyMap: Record<string, any> = {
          'x': 'position',
          'y': 'position',
          'width': 'width',
          'height': 'height',
          'rotation': 'rotation',
          'opacity': 'opacity',
          'zIndex': 'zIndex'
        }

        const animatableProperty = animatablePropertyMap[property]
        if (animatableProperty) {
          if (property === 'x' || property === 'y') {
            // 位置属性需要特殊处理，创建position关键帧
            const currentX = property === 'x' ? value : timelineItem.x
            const currentY = property === 'y' ? value : timelineItem.y
            const positionValue = { x: currentX, y: currentY }

            // 直接调用关键帧管理器创建关键帧
            KeyFrameAnimationManager.createKeyFrame(
              timelineItem,
              'position',
              playbackModule.currentTime.value,
              positionValue,
              configModule.videoResolution.value
            )
          } else {
            // 其他属性直接创建关键帧
            KeyFrameAnimationManager.createKeyFrame(
              timelineItem,
              animatableProperty,
              playbackModule.currentTime.value,
              value,
              configModule.videoResolution.value
            )
          }

          console.log(`🎬 [VideoStore] 已通过关键帧系统更新属性: ${property} = ${value}`)
          return
        }
      } finally {
        // 🆕 重置标志
        isUpdatingFromKeyFrame = false
      }
    }

    // 📄 对于非动画clip或不支持动画的属性，直接更新sprite
    console.log(`📄 [VideoStore] 直接更新sprite属性: ${property} = ${value}`)
    const sprite = timelineItem.sprite

    switch (property) {
      case 'x':
      case 'y':
        // 位置更新需要坐标转换
        const currentX = property === 'x' ? value : timelineItem.x
        const currentY = property === 'y' ? value : timelineItem.y
        const webavCoords = projectToWebavCoords(
          currentX,
          currentY,
          sprite.rect.w,
          sprite.rect.h,
          configModule.videoResolution.value.width,
          configModule.videoResolution.value.height
        )
        sprite.rect.x = webavCoords.x
        sprite.rect.y = webavCoords.y
        break

      case 'width':
        // 保持中心点不变的宽度缩放
        const centerX = timelineItem.x
        const centerY = timelineItem.y
        sprite.rect.w = value
        const webavCoordsW = projectToWebavCoords(
          centerX,
          centerY,
          value,
          sprite.rect.h,
          configModule.videoResolution.value.width,
          configModule.videoResolution.value.height
        )
        sprite.rect.x = webavCoordsW.x
        sprite.rect.y = webavCoordsW.y
        break

      case 'height':
        // 保持中心点不变的高度缩放
        const centerXH = timelineItem.x
        const centerYH = timelineItem.y
        sprite.rect.h = value
        const webavCoordsH = projectToWebavCoords(
          centerXH,
          centerYH,
          sprite.rect.w,
          value,
          configModule.videoResolution.value.width,
          configModule.videoResolution.value.height
        )
        sprite.rect.x = webavCoordsH.x
        sprite.rect.y = webavCoordsH.y
        break

      case 'rotation':
        sprite.rect.angle = value
        break

      case 'opacity':
        sprite.opacity = Math.max(0, Math.min(1, value))
        break

      case 'zIndex':
        sprite.zIndex = value
        break

      case 'volume':
        if (timelineItem.mediaType === 'video' && sprite instanceof VideoVisibleSprite) {
          sprite.setVolume(Math.max(0, Math.min(1, value)))
        }
        break

      case 'isMuted':
        if (timelineItem.mediaType === 'video' && sprite instanceof VideoVisibleSprite) {
          sprite.setMuted(value)
        }
        break

      default:
        console.warn(`Unknown property: ${property}`)
    }

    console.log(`🔄 [VideoStore] Updated sprite property ${property} = ${value} for ${timelineItemId}`)
  }

  // ==================== 素材管理方法 ====================
  // 使用媒体模块的方法，但需要包装以提供额外的依赖
  function addMediaItem(mediaItem: MediaItem) {
    mediaModule.addMediaItem(mediaItem, timelineModule.timelineItems, trackModule.tracks)
  }

  // ==================== 历史记录包装方法 ====================

  /**
   * 带历史记录的添加时间轴项目方法
   * @param timelineItem 要添加的时间轴项目
   */
  async function addTimelineItemWithHistory(timelineItem: TimelineItem) {
    const command = new AddTimelineItemCommand(
      timelineItem,
      {
        addTimelineItem: timelineModule.addTimelineItem,
        removeTimelineItem: timelineModule.removeTimelineItem,
        getTimelineItem: timelineModule.getTimelineItem,
      },
      {
        addSprite: webavModule.addSprite,
        removeSprite: webavModule.removeSprite,
      },
      {
        getMediaItem: mediaModule.getMediaItem,
      },
      configModule
    )
    await historyModule.executeCommand(command)
  }

  /**
   * 带历史记录的删除时间轴项目方法
   * @param timelineItemId 要删除的时间轴项目ID
   */
  async function removeTimelineItemWithHistory(timelineItemId: string) {
    // 获取要删除的时间轴项目
    const timelineItem = timelineModule.getTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`⚠️ 时间轴项目不存在，无法删除: ${timelineItemId}`)
      return
    }

    const command = new RemoveTimelineItemCommand(
      timelineItemId,
      timelineItem, // 传入完整的timelineItem用于保存重建数据
      {
        addTimelineItem: timelineModule.addTimelineItem,
        removeTimelineItem: timelineModule.removeTimelineItem,
        getTimelineItem: timelineModule.getTimelineItem,
      },
      {
        addSprite: webavModule.addSprite,
        removeSprite: webavModule.removeSprite,
      },
      {
        getMediaItem: mediaModule.getMediaItem,
      },
      configModule
    )
    await historyModule.executeCommand(command)
  }

  /**
   * 带历史记录的移动时间轴项目方法
   * @param timelineItemId 要移动的时间轴项目ID
   * @param newPosition 新的时间位置（秒）
   * @param newTrackId 新的轨道ID（可选）
   */
  async function moveTimelineItemWithHistory(
    timelineItemId: string,
    newPosition: number,
    newTrackId?: number
  ) {
    // 获取要移动的时间轴项目
    const timelineItem = timelineModule.getTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`⚠️ 时间轴项目不存在，无法移动: ${timelineItemId}`)
      return
    }

    // 获取当前位置和轨道
    const oldPosition = timelineItem.timeRange.timelineStartTime / 1000000 // 转换为秒
    const oldTrackId = timelineItem.trackId
    const finalNewTrackId = newTrackId !== undefined ? newTrackId : oldTrackId

    // 检查是否有实际变化
    const positionChanged = Math.abs(oldPosition - newPosition) > 0.001 // 允许1毫秒的误差
    const trackChanged = oldTrackId !== finalNewTrackId

    if (!positionChanged && !trackChanged) {
      console.log('⚠️ 位置和轨道都没有变化，跳过移动操作')
      return
    }

    const command = new MoveTimelineItemCommand(
      timelineItemId,
      oldPosition,
      newPosition,
      oldTrackId,
      finalNewTrackId,
      {
        updateTimelineItemPosition: timelineModule.updateTimelineItemPosition,
        getTimelineItem: timelineModule.getTimelineItem,
      },
      {
        getMediaItem: mediaModule.getMediaItem,
      }
    )
    await historyModule.executeCommand(command)
  }

  /**
   * 带历史记录的更新变换属性方法
   * @param timelineItemId 要更新的时间轴项目ID
   * @param newTransform 新的变换属性
   */
  async function updateTimelineItemTransformWithHistory(
    timelineItemId: string,
    newTransform: {
      x?: number
      y?: number
      width?: number
      height?: number
      rotation?: number
      opacity?: number
      zIndex?: number
      duration?: number // 时长（秒）
      playbackRate?: number // 倍速
      volume?: number // 音量（0-1之间）
      isMuted?: boolean // 静音状态
    }
  ): Promise<void> {
    // 获取要更新的时间轴项目
    const timelineItem = timelineModule.getTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`⚠️ 时间轴项目不存在，无法更新变换属性: ${timelineItemId}`)
      return
    }

    // 获取当前的变换属性
    const oldTransform: typeof newTransform = {}

    if (newTransform.x !== undefined) {
      oldTransform.x = timelineItem.x
    }

    if (newTransform.y !== undefined) {
      oldTransform.y = timelineItem.y
    }

    if (newTransform.width !== undefined) {
      oldTransform.width = timelineItem.width
    }

    if (newTransform.height !== undefined) {
      oldTransform.height = timelineItem.height
    }

    if (newTransform.rotation !== undefined) {
      oldTransform.rotation = timelineItem.rotation
    }

    if (newTransform.opacity !== undefined) {
      oldTransform.opacity = timelineItem.opacity
    }

    if (newTransform.zIndex !== undefined) {
      oldTransform.zIndex = timelineItem.zIndex
    }

    if (newTransform.duration !== undefined) {
      // 计算当前时长
      const timeRange = timelineItem.timeRange
      const currentDuration = (timeRange.timelineEndTime - timeRange.timelineStartTime) / 1000000 // 转换为秒
      oldTransform.duration = currentDuration
    }

    if (newTransform.playbackRate !== undefined) {
      // 获取当前倍速（仅对视频有效）
      if (timelineItem.mediaType === 'video' && 'playbackRate' in timelineItem.timeRange) {
        oldTransform.playbackRate = timelineItem.timeRange.playbackRate || 1
      } else {
        oldTransform.playbackRate = 1 // 图片默认为1
      }
    }

    if (newTransform.volume !== undefined) {
      // 获取当前音量（仅对视频有效）
      if (timelineItem.mediaType === 'video') {
        oldTransform.volume = timelineItem.volume ?? 1
      }
    }

    if (newTransform.isMuted !== undefined) {
      // 获取当前静音状态（仅对视频有效）
      if (timelineItem.mediaType === 'video') {
        oldTransform.isMuted = timelineItem.isMuted ?? false
      }
    }

    // 检查是否有实际变化
    const hasChanges = checkTransformChanges(oldTransform, newTransform)
    if (!hasChanges) {
      console.log('⚠️ 变换属性没有变化，跳过更新操作')
      return
    }

    // 确定属性类型
    const propertyType = determinePropertyType(newTransform)

    const command = new UpdateTransformCommand(
      timelineItemId,
      propertyType,
      oldTransform,
      newTransform,
      {
        getTimelineItem: timelineModule.getTimelineItem,
      },
      {
        getMediaItem: mediaModule.getMediaItem,
      },
      {
        updateTimelineItemPlaybackRate: clipOperationsModule.updateTimelineItemPlaybackRate,
      }
    )
    await historyModule.executeCommand(command)
  }

  /**
   * 检查变换属性是否有实际变化
   */
  function checkTransformChanges(
    oldTransform: any,
    newTransform: any
  ): boolean {
    // 检查X位置变化
    if (newTransform.x !== undefined && oldTransform.x !== undefined) {
      const xChanged = Math.abs(oldTransform.x - newTransform.x) > 0.1
      if (xChanged) return true
    }

    // 检查Y位置变化
    if (newTransform.y !== undefined && oldTransform.y !== undefined) {
      const yChanged = Math.abs(oldTransform.y - newTransform.y) > 0.1
      if (yChanged) return true
    }

    // 检查宽度变化
    if (newTransform.width !== undefined && oldTransform.width !== undefined) {
      const widthChanged = Math.abs(oldTransform.width - newTransform.width) > 0.1
      if (widthChanged) return true
    }

    // 检查高度变化
    if (newTransform.height !== undefined && oldTransform.height !== undefined) {
      const heightChanged = Math.abs(oldTransform.height - newTransform.height) > 0.1
      if (heightChanged) return true
    }

    // 检查旋转变化
    if (newTransform.rotation !== undefined && oldTransform.rotation !== undefined) {
      const rotationChanged = Math.abs(oldTransform.rotation - newTransform.rotation) > 0.001 // 约0.06度
      if (rotationChanged) return true
    }

    // 检查透明度变化
    if (newTransform.opacity !== undefined && oldTransform.opacity !== undefined) {
      const opacityChanged = Math.abs(oldTransform.opacity - newTransform.opacity) > 0.001
      if (opacityChanged) return true
    }

    // 检查层级变化
    if (newTransform.zIndex !== undefined && oldTransform.zIndex !== undefined) {
      const zIndexChanged = oldTransform.zIndex !== newTransform.zIndex
      if (zIndexChanged) return true
    }

    // 检查时长变化
    if (newTransform.duration !== undefined && oldTransform.duration !== undefined) {
      const durationChanged = Math.abs(oldTransform.duration - newTransform.duration) > 0.1 // 0.1秒误差容忍
      if (durationChanged) return true
    }

    // 检查倍速变化
    if (newTransform.playbackRate !== undefined && oldTransform.playbackRate !== undefined) {
      const playbackRateChanged = Math.abs(oldTransform.playbackRate - newTransform.playbackRate) > 0.01 // 0.01倍速误差容忍
      if (playbackRateChanged) return true
    }

    // 检查音量变化
    if (newTransform.volume !== undefined && oldTransform.volume !== undefined) {
      const volumeChanged = Math.abs(oldTransform.volume - newTransform.volume) > 0.01 // 0.01音量误差容忍
      if (volumeChanged) return true
    }

    // 检查静音状态变化
    if (newTransform.isMuted !== undefined && oldTransform.isMuted !== undefined) {
      const muteChanged = oldTransform.isMuted !== newTransform.isMuted
      if (muteChanged) return true
    }

    return false
  }

  /**
   * 确定属性类型
   */
  function determinePropertyType(transform: any): 'x' | 'y' | 'width' | 'height' | 'rotation' | 'opacity' | 'zIndex' | 'duration' | 'playbackRate' | 'volume' | 'audioState' | 'multiple' {
    const changedProperties = []

    if (transform.x !== undefined) changedProperties.push('x')
    if (transform.y !== undefined) changedProperties.push('y')
    if (transform.width !== undefined) changedProperties.push('width')
    if (transform.height !== undefined) changedProperties.push('height')
    if (transform.rotation !== undefined) changedProperties.push('rotation')
    if (transform.opacity !== undefined) changedProperties.push('opacity')
    if (transform.zIndex !== undefined) changedProperties.push('zIndex')
    if (transform.duration !== undefined) changedProperties.push('duration')
    if (transform.playbackRate !== undefined) changedProperties.push('playbackRate')
    if (transform.volume !== undefined) changedProperties.push('volume')
    if (transform.isMuted !== undefined) changedProperties.push('audioState')

    // 如果同时有音量和静音状态变化，归类为audioState
    if (transform.volume !== undefined && transform.isMuted !== undefined) {
      return 'audioState'
    }

    return changedProperties.length === 1 ? changedProperties[0] as any : 'multiple'
  }

  /**
   * 带历史记录的分割时间轴项目方法
   * @param timelineItemId 要分割的时间轴项目ID
   * @param splitTime 分割时间点（秒）
   */
  async function splitTimelineItemAtTimeWithHistory(
    timelineItemId: string,
    splitTime: number
  ) {
    // 获取要分割的时间轴项目
    const timelineItem = timelineModule.getTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`⚠️ 时间轴项目不存在，无法分割: ${timelineItemId}`)
      return
    }

    // 检查是否为视频类型（图片不支持分割）
    if (timelineItem.mediaType !== 'video') {
      console.error('❌ 只有视频片段支持分割操作')
      return
    }

    // 检查分割时间是否在项目范围内
    const timelineStartTime = timelineItem.timeRange.timelineStartTime / 1000000 // 转换为秒
    const timelineEndTime = timelineItem.timeRange.timelineEndTime / 1000000 // 转换为秒

    if (splitTime <= timelineStartTime || splitTime >= timelineEndTime) {
      console.error('❌ 分割时间不在项目范围内')
      return
    }

    const command = new SplitTimelineItemCommand(
      timelineItemId,
      timelineItem, // 传入完整的timelineItem用于保存重建数据
      splitTime,
      {
        addTimelineItem: timelineModule.addTimelineItem,
        removeTimelineItem: timelineModule.removeTimelineItem,
        getTimelineItem: timelineModule.getTimelineItem,
      },
      {
        addSprite: webavModule.addSprite,
        removeSprite: webavModule.removeSprite,
      },
      {
        getMediaItem: mediaModule.getMediaItem,
      },
      configModule
    )
    await historyModule.executeCommand(command)
  }

  /**
   * 带历史记录的复制时间轴项目方法
   * @param timelineItemId 要复制的时间轴项目ID
   * @returns 新创建的时间轴项目ID，失败时返回null
   */
  async function duplicateTimelineItemWithHistory(timelineItemId: string): Promise<string | null> {
    // 获取要复制的时间轴项目
    const timelineItem = timelineModule.getTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`⚠️ 时间轴项目不存在，无法复制: ${timelineItemId}`)
      return null
    }

    // 计算新位置（在原项目后面，避免重叠）
    const originalEndTime = timelineItem.timeRange.timelineEndTime / 1000000 // 转换为秒
    const newPosition = originalEndTime + 0.1 // 在原项目结束后0.1秒的位置

    const command = new DuplicateTimelineItemCommand(
      timelineItemId,
      timelineItem, // 传入完整的timelineItem用于保存重建数据
      newPosition,
      {
        addTimelineItem: timelineModule.addTimelineItem,
        removeTimelineItem: timelineModule.removeTimelineItem,
        getTimelineItem: timelineModule.getTimelineItem,
      },
      {
        addSprite: webavModule.addSprite,
        removeSprite: webavModule.removeSprite,
      },
      {
        getMediaItem: mediaModule.getMediaItem,
      },
      configModule
    )

    try {
      await historyModule.executeCommand(command)
      // 返回新创建的项目ID
      return command.newTimelineItemId
    } catch (error) {
      console.error('❌ 复制时间轴项目失败:', error)
      return null
    }
  }

  /**
   * 带历史记录的添加轨道方法
   * @param name 轨道名称（可选）
   * @returns 新创建的轨道ID，失败时返回null
   */
  async function addTrackWithHistory(name?: string): Promise<number | null> {
    const command = new AddTrackCommand(
      name,
      {
        addTrack: trackModule.addTrack,
        removeTrack: trackModule.removeTrack,
        getTrack: trackModule.getTrack,
      }
    )

    try {
      await historyModule.executeCommand(command)
      // 返回新创建的轨道ID
      return command.createdTrackId
    } catch (error) {
      console.error('❌ 添加轨道失败:', error)
      return null
    }
  }

  /**
   * 带历史记录的删除轨道方法
   * @param trackId 要删除的轨道ID
   * @returns 是否成功删除
   */
  async function removeTrackWithHistory(trackId: number): Promise<boolean> {
    // 检查是否为最后一个轨道
    if (trackModule.tracks.value.length <= 1) {
      console.warn('⚠️ 不能删除最后一个轨道')
      return false
    }

    // 检查轨道是否存在
    const track = trackModule.getTrack(trackId)
    if (!track) {
      console.warn(`⚠️ 轨道不存在，无法删除: ${trackId}`)
      return false
    }

    const command = new RemoveTrackCommand(
      trackId,
      {
        addTrack: trackModule.addTrack,
        removeTrack: trackModule.removeTrack,
        getTrack: trackModule.getTrack,
        tracks: trackModule.tracks,
      },
      {
        addTimelineItem: timelineModule.addTimelineItem,
        removeTimelineItem: timelineModule.removeTimelineItem,
        getTimelineItem: timelineModule.getTimelineItem,
        timelineItems: timelineModule.timelineItems,
      },
      {
        addSprite: webavModule.addSprite,
        removeSprite: webavModule.removeSprite,
      },
      {
        getMediaItem: mediaModule.getMediaItem,
      }
    )

    try {
      await historyModule.executeCommand(command)
      return true
    } catch (error) {
      console.error('❌ 删除轨道失败:', error)
      return false
    }
  }

  /**
   * 带历史记录的重命名轨道方法
   * @param trackId 要重命名的轨道ID
   * @param newName 新的轨道名称
   * @returns 是否成功重命名
   */
  async function renameTrackWithHistory(trackId: number, newName: string): Promise<boolean> {
    // 检查轨道是否存在
    const track = trackModule.getTrack(trackId)
    if (!track) {
      console.warn(`⚠️ 轨道不存在，无法重命名: ${trackId}`)
      return false
    }

    // 检查新名称是否有效
    if (!newName.trim()) {
      console.warn('⚠️ 轨道名称不能为空')
      return false
    }

    // 如果名称没有变化，直接返回成功
    if (track.name === newName.trim()) {
      console.log('⚠️ 轨道名称没有变化，无需重命名')
      return true
    }

    const command = new RenameTrackCommand(
      trackId,
      newName.trim(),
      {
        renameTrack: trackModule.renameTrack,
        getTrack: trackModule.getTrack,
      }
    )

    try {
      await historyModule.executeCommand(command)
      return true
    } catch (error) {
      console.error('❌ 重命名轨道失败:', error)
      return false
    }
  }

  /**
   * 带历史记录的自动排列轨道方法（使用批量操作架构）
   * @param trackId 要自动排列的轨道ID
   * @returns 是否成功排列
   */
  async function autoArrangeTrackWithHistory(trackId: number): Promise<boolean> {
    // 检查轨道是否存在
    const track = trackModule.getTrack(trackId)
    if (!track) {
      console.warn(`⚠️ 轨道不存在，无法自动排列: ${trackId}`)
      return false
    }

    // 检查轨道是否有项目
    const trackItems = timelineModule.timelineItems.value.filter(item => item.trackId === trackId)
    if (trackItems.length === 0) {
      console.log(`⚠️ 轨道 ${trackId} 没有片段需要整理`)
      return false
    }

    // 使用新的批量自动排列命令
    const batchCommand = new BatchAutoArrangeTrackCommand(
      trackId,
      trackItems,
      {
        getTimelineItem: timelineModule.getTimelineItem,
        timelineItems: timelineModule.timelineItems,
        updateTimelineItemPosition: timelineModule.updateTimelineItemPosition,
      },
      {
        getMediaItem: mediaModule.getMediaItem,
      },
      {
        getTrack: trackModule.getTrack,
      }
    )

    try {
      await historyModule.executeBatchCommand(batchCommand)
      return true
    } catch (error) {
      console.error('❌ 自动排列轨道失败:', error)
      return false
    }
  }

  /**
   * 带历史记录的切换轨道可见性方法
   * @param trackId 要切换可见性的轨道ID
   * @returns 是否成功切换
   */
  async function toggleTrackVisibilityWithHistory(trackId: number): Promise<boolean> {
    // 检查轨道是否存在
    const track = trackModule.getTrack(trackId)
    if (!track) {
      console.warn(`⚠️ 轨道不存在，无法切换可见性: ${trackId}`)
      return false
    }

    const command = new ToggleTrackVisibilityCommand(
      trackId,
      {
        getTrack: trackModule.getTrack,
        toggleTrackVisibility: trackModule.toggleTrackVisibility,
      },
      {
        timelineItems: timelineModule.timelineItems,
      }
    )

    try {
      await historyModule.executeCommand(command)
      return true
    } catch (error) {
      console.error('❌ 切换轨道可见性失败:', error)
      return false
    }
  }

  /**
   * 带历史记录的切换轨道静音状态方法
   * @param trackId 要切换静音状态的轨道ID
   * @returns 是否成功切换
   */
  async function toggleTrackMuteWithHistory(trackId: number): Promise<boolean> {
    // 检查轨道是否存在
    const track = trackModule.getTrack(trackId)
    if (!track) {
      console.warn(`⚠️ 轨道不存在，无法切换静音状态: ${trackId}`)
      return false
    }

    const command = new ToggleTrackMuteCommand(
      trackId,
      {
        getTrack: trackModule.getTrack,
        toggleTrackMute: trackModule.toggleTrackMute,
      },
      {
        timelineItems: timelineModule.timelineItems,
      }
    )

    try {
      await historyModule.executeCommand(command)
      return true
    } catch (error) {
      console.error('❌ 切换轨道静音状态失败:', error)
      return false
    }
  }

  /**
   * 带历史记录的调整时间范围方法
   * @param timelineItemId 时间轴项目ID
   * @param newTimeRange 新的时间范围
   * @returns 是否成功调整
   */
  async function resizeTimelineItemWithHistory(
    timelineItemId: string,
    newTimeRange: { timelineStartTime: number; timelineEndTime: number; [key: string]: any }
  ): Promise<boolean> {
    // 获取时间轴项目
    const timelineItem = timelineModule.getTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`⚠️ 时间轴项目不存在，无法调整时间范围: ${timelineItemId}`)
      return false
    }

    // 获取原始时间范围
    const originalTimeRange = timelineItem.sprite.getTimeRange()

    // 检查是否有实际变化
    const startTimeChanged = Math.abs(originalTimeRange.timelineStartTime - newTimeRange.timelineStartTime) > 1000 // 允许1毫秒的误差
    const endTimeChanged = Math.abs(originalTimeRange.timelineEndTime - newTimeRange.timelineEndTime) > 1000

    if (!startTimeChanged && !endTimeChanged) {
      console.log('⚠️ 时间范围没有变化，跳过调整操作')
      return false
    }

    const command = new ResizeTimelineItemCommand(
      timelineItemId,
      originalTimeRange,
      newTimeRange,
      {
        getTimelineItem: timelineModule.getTimelineItem,
      },
      {
        getMediaItem: mediaModule.getMediaItem,
      }
    )

    try {
      await historyModule.executeCommand(command)
      return true
    } catch (error) {
      console.error('❌ 调整时间范围失败:', error)
      return false
    }
  }

  /**
   * 批量删除选中的时间轴项目
   * @param timelineItemIds 要删除的时间轴项目ID数组
   * @returns 是否成功删除
   */
  async function batchDeleteTimelineItems(timelineItemIds: string[]): Promise<boolean> {
    if (timelineItemIds.length === 0) {
      console.warn('⚠️ 没有选中要删除的时间轴项目')
      return false
    }

    // 验证所有项目是否存在
    const validItemIds = timelineItemIds.filter(id => timelineModule.getTimelineItem(id))
    if (validItemIds.length === 0) {
      console.warn('⚠️ 所有选中的时间轴项目都不存在')
      return false
    }

    if (validItemIds.length !== timelineItemIds.length) {
      console.warn(`⚠️ ${timelineItemIds.length - validItemIds.length} 个时间轴项目不存在，将删除其余 ${validItemIds.length} 个项目`)
    }

    // 创建批量删除命令
    const batchCommand = new BatchDeleteCommand(
      validItemIds,
      {
        getTimelineItem: timelineModule.getTimelineItem,
        timelineItems: timelineModule.timelineItems,
        addTimelineItem: timelineModule.addTimelineItem,
        removeTimelineItem: timelineModule.removeTimelineItem,
      },
      {
        addSprite: webavModule.addSprite,
        removeSprite: webavModule.removeSprite,
      },
      {
        getMediaItem: mediaModule.getMediaItem,
      },
      configModule
    )

    try {
      await historyModule.executeBatchCommand(batchCommand)
      return true
    } catch (error) {
      console.error('❌ 批量删除时间轴项目失败:', error)
      return false
    }
  }

  // ==================== 关键帧动画历史记录方法 ====================

  /**
   * 带历史记录的创建关键帧方法
   * @param timelineItemId 时间轴项目ID
   * @param property 动画属性
   * @param value 属性值，如果不提供则使用当前值
   * @param time 时间点（秒），如果不提供则使用当前播放时间
   */
  async function createKeyFrameWithHistory(
    timelineItemId: string,
    property: AnimatableProperty,
    value?: any,
    time?: number
  ): Promise<void> {
    const timelineItem = timelineModule.getTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`⚠️ 时间轴项目不存在，无法创建关键帧: ${timelineItemId}`)
      return
    }

    const targetTime = time ?? playbackModule.currentTime.value
    const targetValue = value ?? getCurrentPropertyValue(timelineItem, property)

    const command = new CreateKeyFrameCommand(
      timelineItemId,
      property,
      targetTime,
      targetValue,
      {
        getTimelineItem: timelineModule.getTimelineItem,
      },
      configModule.videoResolution.value
    )

    await historyModule.executeCommand(command)
  }

  /**
   * 带历史记录的删除关键帧方法
   * @param timelineItemId 时间轴项目ID
   * @param property 动画属性
   * @param time 时间点（秒），如果不提供则使用当前播放时间
   */
  async function removeKeyFrameWithHistory(
    timelineItemId: string,
    property: AnimatableProperty,
    time?: number
  ): Promise<void> {
    const timelineItem = timelineModule.getTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`⚠️ 时间轴项目不存在，无法删除关键帧: ${timelineItemId}`)
      return
    }

    const targetTime = time ?? playbackModule.currentTime.value

    const command = new RemoveKeyFrameCommand(
      timelineItemId,
      property,
      targetTime,
      {
        getTimelineItem: timelineModule.getTimelineItem,
      },
      configModule.videoResolution.value
    )

    await historyModule.executeCommand(command)
  }

  /**
   * 带历史记录的更新关键帧方法
   * @param timelineItemId 时间轴项目ID
   * @param property 动画属性
   * @param newValue 新的属性值
   * @param time 时间点（秒），如果不提供则使用当前播放时间
   */
  async function updateKeyFrameWithHistory(
    timelineItemId: string,
    property: AnimatableProperty,
    newValue: number,
    time?: number
  ): Promise<void> {
    const timelineItem = timelineModule.getTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`⚠️ 时间轴项目不存在，无法更新关键帧: ${timelineItemId}`)
      return
    }

    const targetTime = time ?? playbackModule.currentTime.value

    const command = new UpdateKeyFrameCommand(
      timelineItemId,
      property,
      targetTime,
      newValue,
      {
        getTimelineItem: timelineModule.getTimelineItem,
      },
      configModule.videoResolution.value
    )

    await historyModule.executeCommand(command)
  }

  /**
   * 带历史记录的清除动画方法
   * @param timelineItemId 时间轴项目ID
   */
  async function clearAnimationWithHistory(timelineItemId: string): Promise<void> {
    const timelineItem = timelineModule.getTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`⚠️ 时间轴项目不存在，无法清除动画: ${timelineItemId}`)
      return
    }

    const command = new ClearAnimationCommand(
      timelineItemId,
      {
        getTimelineItem: timelineModule.getTimelineItem,
      },
      configModule.videoResolution.value
    )

    await historyModule.executeCommand(command)
  }

  /**
   * 带历史记录的切换动画启用状态方法
   * @param timelineItemId 时间轴项目ID
   * @param enabled 是否启用动画
   */
  async function toggleAnimationWithHistory(
    timelineItemId: string,
    enabled: boolean
  ): Promise<void> {
    const timelineItem = timelineModule.getTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`⚠️ 时间轴项目不存在，无法切换动画状态: ${timelineItemId}`)
      return
    }

    const command = new ToggleAnimationCommand(
      timelineItemId,
      enabled,
      {
        getTimelineItem: timelineModule.getTimelineItem,
      },
      configModule.videoResolution.value
    )

    await historyModule.executeCommand(command)
  }

  function removeMediaItem(mediaItemId: string) {
    mediaModule.removeMediaItem(
      mediaItemId,
      timelineModule.timelineItems,
      trackModule.tracks,
      webavModule.avCanvas.value as any,
      () => {}, // 清理回调，目前为空
    )
  }

  function getMediaItem(mediaItemId: string): MediaItem | undefined {
    return mediaModule.getMediaItem(mediaItemId)
  }

  // ==================== 素材名称管理 ====================
  function updateMediaItemName(mediaItemId: string, newName: string) {
    mediaModule.updateMediaItemName(mediaItemId, newName)
  }

  function updateMediaItem(mediaItem: MediaItem) {
    mediaModule.updateMediaItem(mediaItem)
  }



  // ==================== 视频元素管理方法 ====================
  // 使用媒体模块的视频元素管理方法
  function setVideoElement(clipId: string, videoElement: HTMLVideoElement | null) {
    mediaModule.setVideoElement(clipId, videoElement)
  }

  function getVideoOriginalResolution(clipId: string): { width: number; height: number } {
    return mediaModule.getVideoOriginalResolution(clipId)
  }

  // ==================== 图片元素管理方法 ====================
  // 使用媒体模块的图片元素管理方法
  function setImageElement(clipId: string, imageElement: HTMLImageElement | null) {
    mediaModule.setImageElement(clipId, imageElement)
  }

  function getImageOriginalResolution(clipId: string): { width: number; height: number } {
    return mediaModule.getImageOriginalResolution(clipId)
  }

  return {
    // 新的两层数据结构
    mediaItems: mediaModule.mediaItems,
    timelineItems: timelineModule.timelineItems,
    tracks: trackModule.tracks,
    currentTime: playbackModule.currentTime,
    isPlaying: playbackModule.isPlaying,
    timelineDuration: configModule.timelineDuration,
    totalDuration,
    contentEndTime: viewportModule.contentEndTime,
    playbackRate: playbackModule.playbackRate,
    selectedTimelineItemId: selectionModule.selectedTimelineItemId,
    // 多选状态
    selectedTimelineItemIds: selectionModule.selectedTimelineItemIds,
    isMultiSelectMode: selectionModule.isMultiSelectMode,
    // 编辑设置
    proportionalScale: configModule.proportionalScale,
    // 缩放和滚动状态
    zoomLevel: viewportModule.zoomLevel,
    scrollOffset: viewportModule.scrollOffset,
    frameRate: configModule.frameRate,
    minZoomLevel: viewportModule.minZoomLevel,
    visibleDuration: viewportModule.visibleDuration,
    maxVisibleDuration: viewportModule.maxVisibleDuration,
    getMaxZoomLevel: (timelineWidth: number) =>
      viewportModule.getMaxZoomLevelForTimeline(timelineWidth, configModule.frameRate.value),
    getMaxScrollOffset: viewportModule.getMaxScrollOffsetForTimeline,
    // 素材管理方法
    addMediaItem,
    removeMediaItem,
    getMediaItem,
    updateMediaItemName,
    updateMediaItem,
    // 时间轴管理方法
    addTimelineItem: timelineModule.addTimelineItem,
    removeTimelineItem: timelineModule.removeTimelineItem,
    getTimelineItem: timelineModule.getTimelineItem,
    getTimelineItemsForTrack: (trackId: number) =>
      getTimelineItemsByTrack(trackId, timelineModule.timelineItems.value),
    updateTimelineItemPosition: timelineModule.updateTimelineItemPosition,
    updateTimelineItemSprite: timelineModule.updateTimelineItemSprite,
    // 统一选择管理API
    selectTimelineItems: selectionModule.selectTimelineItems,
    selectTimelineItemsWithHistory: selectionModule.selectTimelineItemsWithHistory,
    syncAVCanvasSelection: selectionModule.syncAVCanvasSelection,
    hasSelection: selectionModule.hasSelection,
    // 兼容性选择方法
    selectTimelineItem: selectionModule.selectTimelineItem,
    clearAllSelections: selectionModule.clearAllSelections,
    toggleTimelineItemSelection: selectionModule.toggleTimelineItemSelection,
    isTimelineItemSelected: selectionModule.isTimelineItemSelected,
    getSelectedTimelineItem: selectionModule.getSelectedTimelineItem,
    getSelectionSummary: selectionModule.getSelectionSummary,
    resetSelectionToDefaults: selectionModule.resetToDefaults,
    findTimelineItemBySprite: (sprite: Raw<VideoVisibleSprite>) =>
      findTimelineItemBySprite(sprite, timelineModule.timelineItems.value),
    // 多选兼容性方法
    addToMultiSelection: selectionModule.addToMultiSelection,
    removeFromMultiSelection: selectionModule.removeFromMultiSelection,
    toggleMultiSelection: selectionModule.toggleMultiSelection,
    clearMultiSelection: selectionModule.clearMultiSelection,
    isInMultiSelection: selectionModule.isInMultiSelection,
    // 视频片段操作方法
    duplicateTimelineItem: clipOperationsModule.duplicateTimelineItem,
    splitTimelineItemAtTime: clipOperationsModule.splitTimelineItemAtTime,
    updateTimelineItemPlaybackRate: clipOperationsModule.updateTimelineItemPlaybackRate,
    getTimelineItemAtTime: (time: number) =>
      getTimelineItemAtTime(time, timelineModule.timelineItems.value),
    autoArrangeTimelineItems: () => autoArrangeTimelineItems(timelineModule.timelineItems),
    autoArrangeTrackItems: (trackId: number) => autoArrangeTrackItems(timelineModule.timelineItems, trackId),
    // 播放控制方法
    setCurrentTime: playbackModule.setCurrentTime,
    setPlaybackRate: playbackModule.setPlaybackRate,
    seekTo: playbackModule.seekTo,
    seekBy: playbackModule.seekBy,
    nextFrame: playbackModule.nextFrame,
    previousFrame: playbackModule.previousFrame,
    setPlaying: playbackModule.setPlaying,
    play: playbackModule.play,
    pause: playbackModule.pause,
    togglePlayPause: playbackModule.togglePlayPause,
    stop: playbackModule.stop,
    resetPlaybackRate: playbackModule.resetPlaybackRate,
    formattedCurrentTime: playbackModule.formattedCurrentTime,
    playbackRateText: playbackModule.playbackRateText,
    getPlaybackSummary: playbackModule.getPlaybackSummary,
    resetPlaybackToDefaults: playbackModule.resetToDefaults,
    // 轨道管理方法
    addTrack: (name?: string) => trackModule.addTrack(name),
    removeTrack: (trackId: number) =>
      trackModule.removeTrack(trackId, timelineModule.timelineItems, timelineModule.removeTimelineItem),
    toggleTrackVisibility: (trackId: number) => trackModule.toggleTrackVisibility(trackId, timelineModule.timelineItems),
    toggleTrackMute: (trackId: number) => trackModule.toggleTrackMute(trackId, timelineModule.timelineItems),
    renameTrack: trackModule.renameTrack,
    setTrackHeight: trackModule.setTrackHeight,
    getTrack: trackModule.getTrack,
    getTracksSummary: trackModule.getTracksSummary,
    resetTracksToDefaults: trackModule.resetTracksToDefaults,
    // 缩放和滚动方法
    setZoomLevel: (newZoomLevel: number, timelineWidth: number = 800) =>
      viewportModule.setZoomLevel(newZoomLevel, timelineWidth, configModule.frameRate.value),
    setScrollOffset: viewportModule.setScrollOffset,
    zoomIn: (factor: number = 1.2, timelineWidth: number = 800) =>
      viewportModule.zoomIn(factor, timelineWidth, configModule.frameRate.value),
    zoomOut: (factor: number = 1.2, timelineWidth: number = 800) =>
      viewportModule.zoomOut(factor, timelineWidth, configModule.frameRate.value),
    scrollLeft: viewportModule.scrollLeft,
    scrollRight: viewportModule.scrollRight,
    scrollToTime: viewportModule.scrollToTime,
    resetViewport: viewportModule.resetViewport,
    getViewportSummary: viewportModule.getViewportSummary,
    timeToPixel: (time: number, timelineWidth: number) =>
      timeToPixel(
        time,
        timelineWidth,
        totalDuration.value,
        viewportModule.zoomLevel.value,
        viewportModule.scrollOffset.value,
      ),
    pixelToTime: (pixel: number, timelineWidth: number) =>
      pixelToTime(
        pixel,
        timelineWidth,
        totalDuration.value,
        viewportModule.zoomLevel.value,
        viewportModule.scrollOffset.value,
      ),
    alignTimeToFrame: (time: number) => alignTimeToFrame(time, configModule.frameRate.value),
    expandTimelineIfNeeded: (targetTime: number) =>
      expandTimelineIfNeeded(targetTime, configModule.timelineDuration),
    // 分辨率相关
    videoResolution: configModule.videoResolution,
    setVideoResolution: configModule.setVideoResolution,
    // 配置管理
    setTimelineDuration: configModule.setTimelineDuration,
    setFrameRate: configModule.setFrameRate,
    setProportionalScale: configModule.setProportionalScale,
    getConfigSummary: configModule.getConfigSummary,
    resetConfigToDefaults: configModule.resetToDefaults,
    // 视频元素管理
    setVideoElement,
    getVideoOriginalResolution,
    // 图片元素管理
    setImageElement,
    getImageOriginalResolution,
    // WebAV 相关状态和方法
    avCanvas: webavModule.avCanvas,
    isWebAVReady: webavModule.isWebAVReady,
    webAVError: webavModule.webAVError,
    setAVCanvas: webavModule.setAVCanvas,
    setWebAVReady: webavModule.setWebAVReady,
    setWebAVError: webavModule.setWebAVError,
    clearWebAVState: webavModule.clearWebAVState,
    isWebAVAvailable: webavModule.isWebAVAvailable,
    getWebAVSummary: webavModule.getWebAVSummary,
    resetWebAVToDefaults: webavModule.resetToDefaults,
    addSpriteToCanvas: webavModule.addSprite,
    removeSpriteFromCanvas: webavModule.removeSprite,
    // 历史管理方法
    canUndo: historyModule.canUndo,
    canRedo: historyModule.canRedo,
    undo: historyModule.undo,
    redo: historyModule.redo,
    clearHistory: historyModule.clear,
    getHistorySummary: historyModule.getHistorySummary,
    // 通知管理方法和状态
    notifications: notificationModule.notifications,
    showNotification: notificationModule.showNotification,
    removeNotification: notificationModule.removeNotification,
    clearNotifications: notificationModule.clearNotifications,
    showSuccess: notificationModule.showSuccess,
    showError: notificationModule.showError,
    showWarning: notificationModule.showWarning,
    showInfo: notificationModule.showInfo,
    addTimelineItemWithHistory,
    removeTimelineItemWithHistory,
    moveTimelineItemWithHistory,
    updateTimelineItemTransformWithHistory,
    splitTimelineItemAtTimeWithHistory,
    duplicateTimelineItemWithHistory,
    addTrackWithHistory,
    removeTrackWithHistory,
    renameTrackWithHistory,
    autoArrangeTrackWithHistory,
    toggleTrackVisibilityWithHistory,
    toggleTrackMuteWithHistory,
    resizeTimelineItemWithHistory,
    batchDeleteTimelineItems,
    // 关键帧动画历史记录方法
    createKeyFrameWithHistory,
    removeKeyFrameWithHistory,
    updateKeyFrameWithHistory,
    clearAnimationWithHistory,
    toggleAnimationWithHistory,
    // 批量操作方法
    startBatch: historyModule.startBatch,
    executeBatchCommand: historyModule.executeBatchCommand,
    // 🆕 Sprite事件同步方法
    handleSpritePropsChange: handleSpritePropsChangeImpl,
    updateTimelineItemProperty,
  }
})
