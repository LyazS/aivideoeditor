import { ref, markRaw, type Raw } from 'vue'
import { AVCanvas } from '@webav/av-canvas'
import { MP4Clip, ImgClip, AudioClip } from '@webav/av-cliper'
import { VideoVisibleSprite } from '../utils/VideoVisibleSprite'
import { ImageVisibleSprite } from '../utils/ImageVisibleSprite'
import type { VideoTimeRange, ImageTimeRange } from '../types'
// 删除 hasVisualProps 导入，因为已被删除
import { useVideoStore } from '../stores/videoStore'
import {
  framesToMicroseconds,
  microsecondsToFrames,
  framesToTimecode,
} from '../stores/utils/timeUtils'
import {
  logWebAVInitStart,
  logWebAVInitStep,
  logWebAVInitSuccess,
  logWebAVInitError,
  logContainerCreation,
  logContainerCreated,
  logCanvasDestroyStart,
  logCanvasBackup,
  logCanvasDestroyComplete,
  logCanvasRecreateStart,
  logSpriteRestore,
  logCoordinateTransform,
  logCanvasRecreateComplete,
  createPerformanceTimer,
  debugError,
} from '../utils/webavDebug'

import type { PlayOptions, CanvasBackup } from '../types'

// 全局WebAV状态 - 确保单例模式
let globalAVCanvas: AVCanvas | null = null
let globalCanvasContainer: HTMLElement | null = null
const globalError = ref<string | null>(null)

// 时间同步锁，防止循环调用
let isUpdatingTime = false

/**
 * WebAV控制器 - 管理AVCanvas和相关操作
 * 使用全局单例模式确保AVCanvas在整个应用中唯一
 *
 * 时间控制架构：
 * UI操作 → webAVControls.seekTo() → WebAV.previewFrame() → timeupdate事件 → videoStore.setCurrentTime()
 *
 * 重要原则：
 * 1. WebAV是时间状态的唯一权威源
 * 2. 所有UI时间操作都必须通过seekTo()方法
 * 3. 使用时间同步锁防止循环调用
 * 4. timeupdate事件是Store状态更新的唯一入口
 */
export function useWebAVControls() {
  const videoStore = useVideoStore()

  /**
   * 程序化创建画布容器DOM元素
   * @param options 容器配置选项
   */
  const createCanvasContainer = (options: {
    width: number
    height: number
    className?: string
    style?: Partial<CSSStyleDeclaration>
  }): HTMLElement => {
    logContainerCreation({
      size: `${options.width}x${options.height}`,
      className: options.className || 'default',
      hasCustomStyles: !!options.style,
      customStylesCount: options.style ? Object.keys(options.style).length : 0,
    })

    const container = document.createElement('div')

    // 设置基本属性
    container.className = options.className || 'webav-canvas-container'
    container.style.width = `${options.width}px`
    container.style.height = `${options.height}px`
    container.style.position = 'relative'
    container.style.backgroundColor = '#000'
    container.style.borderRadius = '8px'
    container.style.overflow = 'hidden'
    // 禁用鼠标事件，防止AVCanvas响应用户交互
    container.style.pointerEvents = 'none'

    // 应用自定义样式
    if (options.style) {
      Object.assign(container.style, options.style)
    }

    // 保存全局引用
    globalCanvasContainer = container

    logContainerCreated({
      element: container.tagName,
      className: container.className,
      finalSize: `${container.style.width} x ${container.style.height}`,
      isGlobalReference: globalCanvasContainer === container,
    })
    return container
  }

  /**
   * 初始化AVCanvas
   * @param container 容器元素（可选，如果不提供则使用全局容器）
   * @param options 配置选项
   */
  const initializeCanvas = async (
    container?: HTMLElement,
    options?: {
      width: number
      height: number
      bgColor: string
    },
  ): Promise<void> => {
    const timer = createPerformanceTimer('WebAV Canvas Initialization')

    logWebAVInitStart({
      hasContainer: !!container,
      containerType: container?.tagName || 'undefined',
      containerSize: container ? `${container.clientWidth}x${container.clientHeight}` : 'undefined',
      options: options || 'using defaults',
    })

    try {
      // 确定使用的容器
      logWebAVInitStep(1, 'Determining target container')
      const targetContainer = container || globalCanvasContainer
      if (!targetContainer) {
        throw new Error('No container available for WebAV Canvas initialization')
      }
      logWebAVInitStep(1, 'Target container determined', {
        element: targetContainer.tagName,
        id: targetContainer.id || 'no-id',
        className: targetContainer.className || 'no-class',
        size: `${targetContainer.clientWidth}x${targetContainer.clientHeight}`,
        isInDOM: document.contains(targetContainer),
      })

      // 确定使用的配置选项
      logWebAVInitStep(2, 'Determining canvas options')
      const targetOptions = options || {
        width: 1920,
        height: 1080,
        bgColor: '#000000',
      }
      logWebAVInitStep(2, 'Canvas options determined', targetOptions)

      // 如果已经初始化过，先销毁旧的实例
      if (globalAVCanvas) {
        logWebAVInitStep(3, 'Destroying existing WebAV Canvas instance', {
          canvasExists: true,
          canvasType: typeof globalAVCanvas,
        })
        globalAVCanvas.destroy()
        globalAVCanvas = null
        logWebAVInitStep(3, 'Existing canvas destroyed successfully')
      } else {
        logWebAVInitStep(3, 'No existing canvas to destroy')
      }

      logWebAVInitStep(4, 'Creating new AVCanvas instance')
      const canvasTimer = createPerformanceTimer('AVCanvas Creation')

      // 创建AVCanvas实例 - 使用markRaw避免响应式包装
      globalAVCanvas = markRaw(new AVCanvas(targetContainer, targetOptions))

      const canvasCreationTime = canvasTimer.end()
      logWebAVInitStep(4, 'AVCanvas instance created successfully', {
        creationTime: `${canvasCreationTime.toFixed(2)}ms`,
        canvasSize: `${targetOptions.width}x${targetOptions.height}`,
        backgroundColor: targetOptions.bgColor,
      })

      logWebAVInitStep(5, 'Setting AVCanvas to store')
      // 将AVCanvas实例设置到store中
      videoStore.setAVCanvas(globalAVCanvas)
      logWebAVInitStep(5, 'AVCanvas set to store successfully')

      logWebAVInitStep(6, 'Setting up event listeners')
      // 设置事件监听器
      setupEventListeners()
      logWebAVInitStep(6, 'Event listeners setup completed')

      logWebAVInitStep(7, 'Clearing error state')
      globalError.value = null
      logWebAVInitStep(7, 'Error state cleared')

      logWebAVInitStep(8, 'Previewing first frame')
      // 预览第一帧
      globalAVCanvas.previewFrame(0)
      logWebAVInitStep(8, 'First frame preview completed')

      logWebAVInitStep(9, 'Marking WebAV as ready')
      // 标记WebAV为就绪状态
      videoStore.setWebAVReady(true)
      logWebAVInitStep(9, 'WebAV marked as ready in store')

      const totalInitTime = timer.end()
      logWebAVInitSuccess(totalInitTime, {
        canvasReady: true,
        storeReady: videoStore.isWebAVReady,
      })
    } catch (err) {
      const totalInitTime = timer.end()
      const errorMessage = `初始化WebAV画布失败: ${(err as Error).message}`
      globalError.value = errorMessage

      logWebAVInitError(err as Error, totalInitTime, {
        containerAvailable: !!container || !!globalCanvasContainer,
        storeState: {
          isWebAVReady: videoStore.isWebAVReady,
          hasAVCanvas: !!videoStore.avCanvas,
        },
      })
      throw new Error(errorMessage)
    }
  }

  /**
   * 设置WebAV事件监听器
   */
  const setupEventListeners = (): void => {
    if (!globalAVCanvas) {
      console.error('❌ [WebAV Events] Cannot setup listeners: globalAVCanvas is null')
      return
    }

    // 播放状态变化事件
    globalAVCanvas.on('playing', () => {
      videoStore.isPlaying = true
    })

    globalAVCanvas.on('paused', () => {
      videoStore.isPlaying = false
    })

    // 时间更新事件
    globalAVCanvas.on('timeupdate', (microseconds: number) => {
      // 使用时间同步锁防止循环调用
      if (isUpdatingTime) {
        // 静默跳过，避免日志污染
        return
      }

      isUpdatingTime = true
      try {
        // 将微秒转换为帧数
        const frames = microsecondsToFrames(microseconds)
        videoStore.setCurrentFrame(frames, false) // 传入帧数，不强制对齐保持流畅
      } finally {
        isUpdatingTime = false
      }
    })

    // 注意：不再监听activeSpriteChange事件，因为我们不希望WebAV的activeSprite影响时间轴选择
    // globalAVCanvas.on('activeSpriteChange', (sprite) => {
    //   videoStore.handleAVCanvasSpriteChange(sprite)
    // })

    // console.log('✅ [WebAV Events] All event listeners registered successfully')
  }

  /**
   * 创建MP4Clip
   * @param file 视频文件
   */
  const createMP4Clip = async (file: File): Promise<Raw<MP4Clip>> => {
    try {
      console.log(`Creating MP4Clip for: ${file.name}`)

      // 创建MP4Clip
      const response = new Response(file)
      const mp4Clip = markRaw(new MP4Clip(response.body!))

      // 等待MP4Clip准备完成
      await mp4Clip.ready

      // 不再存储到全局Map中，因为现在MP4Clip直接存储在MediaItem中
      console.log(`MP4Clip created successfully for: ${file.name}`)
      return mp4Clip
    } catch (err) {
      const errorMessage = `创建MP4Clip失败: ${(err as Error).message}`
      console.error('MP4Clip creation error:', err)
      throw new Error(errorMessage)
    }
  }

  /**
   * 创建ImgClip
   * @param file 图片文件
   */
  const createImgClip = async (file: File): Promise<Raw<ImgClip>> => {
    try {
      console.log(`Creating ImgClip for: ${file.name}`)

      // 创建ImgClip
      const response = new Response(file)
      const imgClip = markRaw(new ImgClip(response.body!))

      // 等待ImgClip准备完成
      await imgClip.ready

      console.log(`ImgClip created successfully for: ${file.name}`)
      return imgClip
    } catch (err) {
      const errorMessage = `创建ImgClip失败: ${(err as Error).message}`
      console.error('ImgClip creation error:', err)
      throw new Error(errorMessage)
    }
  }

  /**
   * 克隆MP4Clip实例
   * @param originalClip 原始MP4Clip
   */
  const cloneMP4Clip = async (originalClip: Raw<MP4Clip>): Promise<Raw<MP4Clip>> => {
    try {
      console.log('Cloning MP4Clip...')

      // 使用WebAV内置的clone方法
      const clonedClip = await originalClip.clone()

      console.log('MP4Clip cloned successfully')
      return markRaw(clonedClip)
    } catch (err) {
      const errorMessage = `克隆MP4Clip失败: ${(err as Error).message}`
      console.error('MP4Clip clone error:', err)
      throw new Error(errorMessage)
    }
  }

  /**
   * 克隆ImgClip实例
   * @param originalClip 原始ImgClip
   */
  const cloneImgClip = async (originalClip: Raw<ImgClip>): Promise<Raw<ImgClip>> => {
    try {
      console.log('Cloning ImgClip...')

      // 使用WebAV内置的clone方法
      const clonedClip = await originalClip.clone()

      console.log('ImgClip cloned successfully')
      return markRaw(clonedClip)
    } catch (err) {
      const errorMessage = `克隆ImgClip失败: ${(err as Error).message}`
      console.error('ImgClip clone error:', err)
      throw new Error(errorMessage)
    }
  }

  /**
   * 创建AudioClip
   * @param file 音频文件
   */
  const createAudioClip = async (file: File): Promise<Raw<AudioClip>> => {
    try {
      console.log(`Creating AudioClip for: ${file.name}`)

      // 创建AudioClip
      const response = new Response(file)
      const audioClip = markRaw(new AudioClip(response.body!))

      // 等待AudioClip准备完成
      await audioClip.ready

      console.log(`AudioClip created successfully for: ${file.name}`)
      return audioClip
    } catch (err) {
      const errorMessage = `创建AudioClip失败: ${(err as Error).message}`
      console.error('AudioClip creation error:', err)
      throw new Error(errorMessage)
    }
  }

  /**
   * 克隆AudioClip实例
   * @param originalClip 原始AudioClip
   */
  const cloneAudioClip = async (originalClip: Raw<AudioClip>): Promise<Raw<AudioClip>> => {
    try {
      console.log('Cloning AudioClip...')

      // 使用WebAV内置的clone方法
      const clonedClip = await originalClip.clone()

      console.log('AudioClip cloned successfully')
      return markRaw(clonedClip)
    } catch (err) {
      const errorMessage = `克隆AudioClip失败: ${(err as Error).message}`
      console.error('AudioClip clone error:', err)
      throw new Error(errorMessage)
    }
  }

  /**
   * 播放控制（帧数接口）
   * @param startFrames 开始帧数
   * @param endFrames 结束帧数，如果未提供则使用总时长作为结束时间
   * @param playbackRate 播放速度倍率
   */
  const play = (startFrames?: number, endFrames?: number, playbackRate?: number): void => {
    if (!globalAVCanvas) return

    // 帧数转换为微秒
    const start = framesToMicroseconds(startFrames || videoStore.currentFrame)

    const playOptions: PlayOptions = {
      start,
      playbackRate: playbackRate || videoStore.playbackRate,
    }

    // 如果没有提供结束时间，使用总时长作为默认结束时间
    const finalEndFrames = endFrames !== undefined ? endFrames : videoStore.contentEndTimeFrames

    if (finalEndFrames !== undefined) {
      const end = framesToMicroseconds(finalEndFrames)
      if (end > start) {
        playOptions.end = end
      } else {
        console.warn('结束帧必须大于开始帧，忽略end参数')
      }
    }

    globalAVCanvas.play(playOptions)

    console.log('▶️ 开始播放:', {
      startFrames: startFrames || videoStore.currentFrame,
      endFrames: finalEndFrames,
      originalEndFrames: endFrames,
      playbackRate: playOptions.playbackRate,
      startTimecode: framesToTimecode(startFrames || videoStore.currentFrame),
      endTimecode: finalEndFrames ? framesToTimecode(finalEndFrames) : undefined,
    })
  }

  /**
   * 暂停播放
   */
  const pause = (): void => {
    if (!globalAVCanvas) return
    globalAVCanvas.pause()
  }

  /**
   * 跳转到指定帧数
   * 这是时间控制的唯一入口点，所有UI时间操作都应该通过此方法
   * @param frames 帧数
   */
  const seekTo = (frames: number): void => {
    if (!globalAVCanvas) return

    // 设置时间同步锁，防止循环调用
    isUpdatingTime = true

    try {
      const microseconds = framesToMicroseconds(frames)
      globalAVCanvas.previewFrame(microseconds)

      // console.log('🎯 WebAV seekTo:', {
      //   frames,
      //   timecode: framesToTimecode(frames),
      //   microseconds,
      // })

      // 直接更新store状态，因为previewFrame可能不会触发timeupdate事件
      videoStore.setCurrentFrame(frames, false)
    } finally {
      // 延迟重置锁，确保任何可能的timeupdate事件被处理
      setTimeout(() => {
        isUpdatingTime = false
      }, 10)
    }
  }

  /**
   * 销毁WebAV实例
   */
  const destroy = (): void => {
    if (globalAVCanvas) {
      globalAVCanvas.destroy()
      globalAVCanvas = null
    }

    // 清理错误状态
    globalError.value = null
  }

  /**
   * 获取WebAV实例（用于高级操作）
   */
  const getAVCanvas = (): AVCanvas | null => {
    return globalAVCanvas
  }

  /**
   * 获取画布容器DOM元素
   */
  const getCanvasContainer = (): HTMLElement | null => {
    return globalCanvasContainer
  }

  /**
   * 销毁当前画布并备份内容
   */
  const destroyCanvas = async (): Promise<CanvasBackup | null> => {
    const destroyTimer = createPerformanceTimer('Canvas Destroy')

    if (!globalAVCanvas) {
      console.log('⚠️ [Canvas Rebuild] No canvas to destroy')
      return null
    }

    logCanvasDestroyStart({
      hasCanvas: !!globalAVCanvas,
      isPlaying: videoStore.isPlaying,
      currentFrame: videoStore.currentFrame,
      timelineItemsCount: videoStore.timelineItems.length,
    })

    // 备份当前状态 - 只备份元数据，不备份WebAV对象
    const backup: CanvasBackup = {
      timelineItems: [],
      currentFrame: videoStore.currentFrame,
      isPlaying: videoStore.isPlaying,
    }

    // 备份所有时间轴项目的元数据
    const timelineItems = videoStore.timelineItems
    for (const item of timelineItems) {
      // 获取素材名称用于备份（特殊处理文本类型）
      let mediaName: string
      if (item.mediaType === 'text') {
        // 类型检查确保这是文本项目，配置应该有文本属性
        const textConfig = item.config as import('../types').TextMediaConfig
        mediaName = item.mediaName || `文本: ${textConfig?.text?.substring(0, 10) || '未知'}...`
      } else {
        const mediaItem = videoStore.getMediaItem(item.mediaItemId)
        mediaName = mediaItem?.name || '未知素材'
      }

      backup.timelineItems.push({
        id: item.id,
        mediaItemId: item.mediaItemId,
        trackId: item.trackId,
        mediaType: item.mediaType,
        timeRange: { ...item.timeRange },
        config: { ...item.config },
        mediaName,
      })
    }

    logCanvasBackup(backup.timelineItems.length, {
      timelineItems: backup.timelineItems.length,
      isPlaying: backup.isPlaying,
      currentFrame: backup.currentFrame,
    })

    try {
      // 暂停播放
      if (videoStore.isPlaying) {
        console.log('⏸️ 因画布销毁暂停播放')
        globalAVCanvas.pause()
      }

      // 清理画布
      globalAVCanvas.destroy()
      globalAVCanvas = null

      // 清理store中的引用
      videoStore.setAVCanvas(null)
      videoStore.setWebAVReady(false)

      const destroyTime = destroyTimer.end()
      logCanvasDestroyComplete(destroyTime, backup.timelineItems.length)
      return backup
    } catch (error) {
      const destroyTime = destroyTimer.end()
      debugError('Canvas destruction failed', error as Error, {
        destroyTime: `${destroyTime.toFixed(2)}ms`,
        backupTimelineItems: backup.timelineItems.length,
      })
      return backup
    }
  }

  /**
   * 重新创建画布并恢复内容
   */
  const recreateCanvas = async (
    container: HTMLElement,
    options: {
      width: number
      height: number
      bgColor: string
    },
    backup?: CanvasBackup | null,
  ): Promise<void> => {
    const recreateTimer = createPerformanceTimer('Canvas Recreate')

    logCanvasRecreateStart({
      containerSize: `${container.clientWidth}x${container.clientHeight}`,
      canvasOptions: options,
      hasBackup: !!backup,
      backupTimelineItems: backup?.timelineItems.length || 0,
    })

    try {
      // 重新初始化画布
      await initializeCanvas(container, options)

      // 如果有备份内容，从源头重建所有时间轴项目
      if (backup && backup.timelineItems.length > 0) {
        const avCanvas = getAVCanvas()
        if (!avCanvas) {
          throw new Error('Canvas recreation failed - no canvas available')
        }

        // 导入工厂函数
        const { createSpriteFromMediaItem } = await import('../utils/spriteFactory')

        // 恢复每个时间轴项目
        let restoredCount = 0
        for (const itemData of backup.timelineItems) {
          try {
            logSpriteRestore(
              itemData.id,
              `Restoring timeline item ${restoredCount + 1}/${backup.timelineItems.length}`,
            )

            // 从原始素材重新创建sprite
            const mediaItem = videoStore.getMediaItem(itemData.mediaItemId)
            if (!mediaItem) {
              throw new Error(`Media item not found: ${itemData.mediaItemId}`)
            }

            const newSprite = await createSpriteFromMediaItem(mediaItem)
            logSpriteRestore(itemData.id, 'Sprite created from media item')

            // 恢复时间范围设置
            newSprite.setTimeRange(itemData.timeRange)
            logSpriteRestore(itemData.id, 'Time range restored', itemData.timeRange)

            // 恢复变换属性 - 需要处理新旧画布分辨率不同的情况（类型安全版本）
            if (itemData.mediaType === 'video' || itemData.mediaType === 'image') {
              const { projectToWebavCoords } = await import('../utils/coordinateTransform')
              const { hasVisualPropsData } = await import('../types')

              // 类型安全的配置访问（使用类型守卫）
              if (!hasVisualPropsData(itemData)) {
                console.warn('🎨 [WebAV Controls] Item does not have visual properties:', itemData.mediaType)
                continue
              }

              const config = itemData.config
              const newWebavCoords = projectToWebavCoords(
                config.x,
                config.y,
                config.width,
                config.height,
                options.width,
                options.height,
              )

              // 设置新的WebAV坐标
              newSprite.rect.x = newWebavCoords.x
              newSprite.rect.y = newWebavCoords.y
              newSprite.rect.w = config.width
              newSprite.rect.h = config.height

              logCoordinateTransform(itemData.id, {
                projectCoords: {
                  x: config.x,
                  y: config.y,
                },
                newCanvasSize: { width: options.width, height: options.height },
                newWebAVCoords: { x: newWebavCoords.x, y: newWebavCoords.y },
                size: { w: config.width, h: config.height },
              })

              // 恢复其他属性
              newSprite.zIndex = config.zIndex
              newSprite.opacity = config.opacity
              newSprite.rect.angle = config.rotation
            }

            logSpriteRestore(itemData.id, 'Properties restored', {
              zIndex: newSprite.zIndex,
              opacity: newSprite.opacity,
              rotation: newSprite.rect.angle,
            })

            // 添加到画布
            await avCanvas.addSprite(newSprite)
            logSpriteRestore(itemData.id, 'Added to canvas')

            // 更新store中的引用
            videoStore.updateTimelineItemSprite(itemData.id, markRaw(newSprite))
            logSpriteRestore(itemData.id, 'Store reference updated')

            // 🔄 重新设置双向数据同步 - 这是关键步骤！
            const syncTimelineItem = videoStore.getLocalTimelineItem(itemData.id)
            if (syncTimelineItem) {
              videoStore.setupBidirectionalSync(syncTimelineItem)
              logSpriteRestore(itemData.id, 'Bidirectional sync reestablished')
            }

            restoredCount++
            logSpriteRestore(
              itemData.id,
              `Restoration completed (${restoredCount}/${backup.timelineItems.length})`,
            )
          } catch (error) {
            debugError(`Failed to restore timeline item: ${itemData.id}`, error as Error)
          }
        }

        // 恢复播放状态
        if (backup.isPlaying) {
          // 延迟一点再播放，确保所有sprite都已添加
          setTimeout(() => {
            play(backup.currentFrame)
          }, 100)
        } else {
          seekTo(backup.currentFrame)
        }
      }

      const totalRecreateTime = recreateTimer.end()
      logCanvasRecreateComplete(totalRecreateTime, {
        canvasSize: `${options.width}x${options.height}`,
        restoredTimelineItems: backup?.timelineItems.length || 0,
        finalState: {
          isPlaying: backup?.isPlaying || false,
          currentFrame: backup?.currentFrame || 0,
        },
      })
    } catch (error) {
      const totalRecreateTime = recreateTimer.end()
      debugError('Canvas recreation failed', error as Error, {
        totalTime: `${totalRecreateTime.toFixed(2)}ms`,
        canvasOptions: options,
        backupTimelineItems: backup?.timelineItems.length || 0,
      })
      throw error
    }
  }

  return {
    // 状态
    error: globalError,

    // 方法
    createCanvasContainer,
    initializeCanvas,
    createMP4Clip,
    createImgClip,
    createAudioClip,
    cloneMP4Clip,
    cloneImgClip,
    cloneAudioClip,
    play,
    pause,
    seekTo,
    destroy,
    getAVCanvas,
    getCanvasContainer,
    destroyCanvas,
    recreateCanvas,
  }
}

/**
 * 检查WebAV是否已经初始化
 */
export function isWebAVReady(): boolean {
  return globalAVCanvas !== null
}

/**
 * 等待WebAV初始化完成
 */
export function waitForWebAVReady(timeout: number = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    if (isWebAVReady()) {
      resolve(true)
      return
    }

    const startTime = Date.now()
    const checkInterval = setInterval(() => {
      if (isWebAVReady()) {
        clearInterval(checkInterval)
        resolve(true)
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval)
        resolve(false)
      }
    }, 100)
  })
}
