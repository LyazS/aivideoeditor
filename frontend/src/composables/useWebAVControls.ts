import { ref, markRaw, type Raw } from 'vue'
import { AVCanvas } from '@webav/av-canvas'
import { MP4Clip } from '@webav/av-cliper'
import { CustomVisibleSprite } from '../utils/customVisibleSprite'
import { useVideoStore } from '../stores/videoStore'
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
  debugError
} from '../utils/webavDebug'

// 定义播放选项接口
interface PlayOptions {
  start: number
  playbackRate: number
  end?: number
}

// 全局WebAV状态 - 确保单例模式
let globalAVCanvas: AVCanvas | null = null
let globalCanvasContainer: HTMLElement | null = null
const globalError = ref<string | null>(null)

// 画布重新创建时的内容备份
interface CanvasBackup {
  sprites: Array<{
    sprite: Raw<CustomVisibleSprite>
    clip: MP4Clip
    timelineItemId: string
  }>
  currentTime: number
  isPlaying: boolean
}

/**
 * WebAV控制器 - 管理AVCanvas和相关操作
 * 使用全局单例模式确保AVCanvas在整个应用中唯一
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
      customStylesCount: options.style ? Object.keys(options.style).length : 0
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
      isGlobalReference: globalCanvasContainer === container
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
    }
  ): Promise<void> => {
    const timer = createPerformanceTimer('WebAV Canvas Initialization')

    logWebAVInitStart({
      hasContainer: !!container,
      containerType: container?.tagName || 'undefined',
      containerSize: container ? `${container.clientWidth}x${container.clientHeight}` : 'undefined',
      options: options || 'using defaults'
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
        isInDOM: document.contains(targetContainer)
      })

      // 确定使用的配置选项
      logWebAVInitStep(2, 'Determining canvas options')
      const targetOptions = options || {
        width: 1920,
        height: 1080,
        bgColor: '#000000'
      }
      logWebAVInitStep(2, 'Canvas options determined', targetOptions)

      // 如果已经初始化过，先销毁旧的实例
      if (globalAVCanvas) {
        logWebAVInitStep(3, 'Destroying existing WebAV Canvas instance', {
          canvasExists: true,
          canvasType: typeof globalAVCanvas
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
        backgroundColor: targetOptions.bgColor
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
        storeReady: videoStore.isWebAVReady
      })
    } catch (err) {
      const totalInitTime = timer.end()
      const errorMessage = `初始化WebAV画布失败: ${(err as Error).message}`
      globalError.value = errorMessage

      logWebAVInitError(err as Error, totalInitTime, {
        containerAvailable: !!container || !!globalCanvasContainer,
        storeState: {
          isWebAVReady: videoStore.isWebAVReady,
          hasAVCanvas: !!videoStore.avCanvas
        }
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
    globalAVCanvas.on('timeupdate', (time: number) => {
      // 将微秒转换为秒
      const timeInSeconds = time / 1000000
      videoStore.setCurrentTime(timeInSeconds, false) // 不强制对齐帧，保持流畅
    })

    // 活动精灵变化事件
    globalAVCanvas.on('activeSpriteChange', (sprite) => {
      // 处理选中状态的变化 - 同步到时间轴选择
      // 类型断言：我们知道这里的sprite是CustomVisibleSprite或null
      videoStore.handleAVCanvasSpriteChange(sprite as CustomVisibleSprite | null)
    })

    console.log('✅ [WebAV Events] All event listeners registered successfully')
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
   * 播放控制
   */
  const play = (startTime?: number, endTime?: number): void => {
    if (!globalAVCanvas) return

    const start = (startTime || videoStore.currentTime) * 1000000 // 转换为微秒

    // 构建播放参数
    const playOptions: PlayOptions = {
      start,
      playbackRate: videoStore.playbackRate
    }

    // 只有明确指定了结束时间才添加end参数
    if (endTime !== undefined) {
      const end = endTime * 1000000
      // 确保结束时间大于开始时间
      if (end > start) {
        playOptions.end = end
      } else {
        console.warn('结束时间必须大于开始时间，忽略end参数')
      }
    }

    console.log('WebAV play options:', playOptions)
    globalAVCanvas.play(playOptions)
  }

  /**
   * 暂停播放
   */
  const pause = (): void => {
    if (!globalAVCanvas) return
    globalAVCanvas.pause()
  }

  /**
   * 跳转到指定时间
   * @param time 时间（秒）
   */
  const seekTo = (time: number): void => {
    if (!globalAVCanvas) return

    const timeMicroseconds = time * 1000000
    globalAVCanvas.previewFrame(timeMicroseconds)
  }

  /**
   * 获取当前帧截图
   */
  const captureFrame = (): string | null => {
    if (!globalAVCanvas) return null
    return globalAVCanvas.captureImage()
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
      currentTime: videoStore.currentTime,
      timelineItemsCount: videoStore.timelineItems.length
    })

    // 备份当前状态
    const backup: CanvasBackup = {
      sprites: [],
      currentTime: videoStore.currentTime,
      isPlaying: videoStore.isPlaying
    }

    // 备份所有sprites
    const timelineItems = videoStore.timelineItems
    for (const item of timelineItems) {
      if (item.sprite) {
        const clip = item.sprite.getClip()
        if (clip) {
          backup.sprites.push({
            sprite: item.sprite,
            clip: clip as MP4Clip,
            timelineItemId: item.id
          })
        }
      }
    }

    logCanvasBackup(backup.sprites.length, {
      sprites: backup.sprites.length,
      isPlaying: backup.isPlaying,
      currentTime: backup.currentTime
    })

    try {
      // 暂停播放
      if (videoStore.isPlaying) {
        globalAVCanvas.pause()
      }

      // 清理画布
      globalAVCanvas.destroy()
      globalAVCanvas = null

      // 清理store中的引用
      videoStore.setAVCanvas(null)
      videoStore.setWebAVReady(false)

      const destroyTime = destroyTimer.end()
      logCanvasDestroyComplete(destroyTime, backup.sprites.length)
      return backup
    } catch (error) {
      const destroyTime = destroyTimer.end()
      debugError('Canvas destruction failed', error as Error, {
        destroyTime: `${destroyTime.toFixed(2)}ms`,
        backupSprites: backup.sprites.length
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
    backup?: CanvasBackup | null
  ): Promise<void> => {
    const recreateTimer = createPerformanceTimer('Canvas Recreate')

    logCanvasRecreateStart({
      containerSize: `${container.clientWidth}x${container.clientHeight}`,
      canvasOptions: options,
      hasBackup: !!backup,
      backupSprites: backup?.sprites.length || 0
    })

    try {
      // 重新初始化画布
      await initializeCanvas(container, options)

      // 如果有备份内容，恢复sprites
      if (backup && backup.sprites.length > 0) {
        const avCanvas = getAVCanvas()
        if (!avCanvas) {
          throw new Error('Canvas recreation failed - no canvas available')
        }

        // 恢复每个sprite
        let restoredCount = 0
        for (const spriteBackup of backup.sprites) {
          try {
            logSpriteRestore(spriteBackup.timelineItemId, `Restoring sprite ${restoredCount + 1}/${backup.sprites.length}`)

            // 克隆MP4Clip
            const clonedClip = await cloneMP4Clip(spriteBackup.clip)
            logSpriteRestore(spriteBackup.timelineItemId, 'MP4Clip cloned')

            // 创建新的CustomVisibleSprite
            const newSprite = new CustomVisibleSprite(clonedClip)

            // 恢复时间范围设置
            const originalTimeRange = spriteBackup.sprite.getTimeRange()
            newSprite.setTimeRange(originalTimeRange)
            logSpriteRestore(spriteBackup.timelineItemId, 'Time range restored', originalTimeRange)

            // 恢复变换属性 - 需要处理新旧画布分辨率不同的情况
            const restoredTimelineItem = videoStore.getTimelineItem(spriteBackup.timelineItemId)
            if (restoredTimelineItem) {
              // 使用TimelineItem中存储的项目坐标系坐标来重新计算新画布分辨率下的WebAV坐标
              const { projectToWebavCoords } = await import('../utils/coordinateTransform')
              const newWebavCoords = projectToWebavCoords(
                restoredTimelineItem.position.x,
                restoredTimelineItem.position.y,
                restoredTimelineItem.size.width,
                restoredTimelineItem.size.height,
                options.width,
                options.height
              )

              // 设置新的WebAV坐标
              newSprite.rect.x = newWebavCoords.x
              newSprite.rect.y = newWebavCoords.y
              newSprite.rect.w = restoredTimelineItem.size.width
              newSprite.rect.h = restoredTimelineItem.size.height

              logCoordinateTransform(spriteBackup.timelineItemId, {
                projectCoords: { x: restoredTimelineItem.position.x, y: restoredTimelineItem.position.y },
                newCanvasSize: { width: options.width, height: options.height },
                newWebAVCoords: { x: newWebavCoords.x, y: newWebavCoords.y },
                size: { w: restoredTimelineItem.size.width, h: restoredTimelineItem.size.height }
              })
            } else {
              // 如果找不到TimelineItem，使用原始坐标作为备用方案
              const originalRect = spriteBackup.sprite.rect
              newSprite.rect.x = originalRect.x
              newSprite.rect.y = originalRect.y
              newSprite.rect.w = originalRect.w
              newSprite.rect.h = originalRect.h

              logCoordinateTransform(spriteBackup.timelineItemId, {
                warning: 'TimelineItem not found, using original coordinates',
                originalCoords: { x: originalRect.x, y: originalRect.y, w: originalRect.w, h: originalRect.h }
              })
            }

            // 恢复其他属性
            newSprite.zIndex = spriteBackup.sprite.zIndex
            newSprite.opacity = spriteBackup.sprite.opacity
            logSpriteRestore(spriteBackup.timelineItemId, 'Properties restored', {
              zIndex: newSprite.zIndex,
              opacity: newSprite.opacity
            })

            // 添加到画布
            await avCanvas.addSprite(newSprite)
            logSpriteRestore(spriteBackup.timelineItemId, 'Added to canvas')

            // 更新store中的引用
            videoStore.updateTimelineItemSprite(spriteBackup.timelineItemId, markRaw(newSprite))
            logSpriteRestore(spriteBackup.timelineItemId, 'Store reference updated')

            // 🔄 重新设置双向数据同步 - 这是关键步骤！
            const syncTimelineItem = videoStore.getTimelineItem(spriteBackup.timelineItemId)
            if (syncTimelineItem) {
              videoStore.setupBidirectionalSync(syncTimelineItem)
              logSpriteRestore(spriteBackup.timelineItemId, 'Bidirectional sync reestablished')
            }

            restoredCount++
            logSpriteRestore(spriteBackup.timelineItemId, `Restoration completed (${restoredCount}/${backup.sprites.length})`)
          } catch (error) {
            debugError(`Failed to restore sprite: ${spriteBackup.timelineItemId}`, error as Error)
          }
        }

        // 恢复播放状态
        if (backup.isPlaying) {
          // 延迟一点再播放，确保所有sprite都已添加
          setTimeout(() => {
            play(backup.currentTime)
          }, 100)
        } else {
          seekTo(backup.currentTime)
        }
      }

      const totalRecreateTime = recreateTimer.end()
      logCanvasRecreateComplete(totalRecreateTime, {
        canvasSize: `${options.width}x${options.height}`,
        restoredSprites: backup?.sprites.length || 0,
        finalState: {
          isPlaying: backup?.isPlaying || false,
          currentTime: backup?.currentTime || 0
        }
      })
    } catch (error) {
      const totalRecreateTime = recreateTimer.end()
      debugError('Canvas recreation failed', error as Error, {
        totalTime: `${totalRecreateTime.toFixed(2)}ms`,
        canvasOptions: options,
        backupSprites: backup?.sprites.length || 0
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
    cloneMP4Clip,
    play,
    pause,
    seekTo,
    captureFrame,
    destroy,
    getAVCanvas,
    getCanvasContainer,
    destroyCanvas,
    recreateCanvas
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
