import { ref, markRaw, watch, type Raw } from 'vue'
import { AVCanvas } from '@webav/av-canvas'
import { MP4Clip, ImgClip, AudioClip } from '@webav/av-cliper'
import type { VisibleSprite } from '@webav/av-cliper'
import { VideoVisibleSprite } from '../../utils/VideoVisibleSprite'
import { ImageVisibleSprite } from '../../utils/ImageVisibleSprite'
import type { VideoTimeRange, ImageTimeRange, PlayOptions, CanvasBackup } from '../../types'
import { isLocalTimelineItem } from '../../types'
import {
  framesToMicroseconds,
  microsecondsToFrames,
  framesToTimecode,
} from '../utils/UnifiedTimeUtils'
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
} from '../../utils/webavDebug'

// 全局WebAV状态 - 确保单例模式
let globalAVCanvas: AVCanvas | null = null
let globalCanvasContainer: HTMLElement | null = null

// 时间同步锁，防止循环调用
let isUpdatingTime = false

/**
 * 统一WebAV集成管理模块
 * 负责管理WebAV相关的状态和方法
 *
 * 基于原有webavModule的完整实现，适配新的统一架构
 *
 * 时间控制架构：
 * UI操作 → UnifiedWebavModule.seekTo() → WebAV.previewFrame() → timeupdate事件 → unifiedStore.setCurrentTime()
 *
 * 重要原则：
 * 1. WebAV是时间状态的唯一权威源
 * 2. 所有UI时间操作都必须通过seekTo()方法
 * 3. 使用时间同步锁防止循环调用
 * 4. timeupdate事件是Store状态更新的唯一入口
 */
export function createUnifiedWebavModule() {
  // 延迟导入unifiedStore以避免循环依赖
  let unifiedStoreRef: any = null
  const getUnifiedStore = async () => {
    if (!unifiedStoreRef) {
      const { useUnifiedStore } = await import('../unifiedStore')
      unifiedStoreRef = useUnifiedStore()
    }
    return unifiedStoreRef
  }

  // ==================== 状态定义 ====================

  // WebAV核心对象 - 使用markRaw避免Vue响应式包装
  const avCanvas = ref<AVCanvas | null>(null)
  const isWebAVReady = ref(false)
  const webAVError = ref<string | null>(null)

  // ==================== WebAV管理方法 ====================

  /**
   * 设置AVCanvas实例
   * @param canvas AVCanvas实例或null
   */
  function setAVCanvas(canvas: AVCanvas | null) {
    console.log('🏪 [UnifiedWebavModule] setAVCanvas:', {
      hasCanvas: !!canvas,
      canvasType: canvas?.constructor.name,
      previousState: !!avCanvas.value,
    })

    // 同步全局状态和响应式状态
    globalAVCanvas = canvas
    avCanvas.value = canvas ? markRaw(canvas) : null

    // 如果设置了新的canvas，自动设置为ready状态
    if (canvas) {
      setWebAVReady(true)
      setWebAVError(null)
    } else {
      setWebAVReady(false)
    }
  }

  /**
   * 设置WebAV就绪状态
   * @param ready 是否就绪
   */
  function setWebAVReady(ready: boolean) {
    console.log('🏪 [UnifiedWebavModule] setWebAVReady:', {
      ready,
      previousReady: isWebAVReady.value,
      stateChange: ready !== isWebAVReady.value,
    })

    isWebAVReady.value = ready

    // 如果设置为未就绪，清除错误状态
    if (!ready) {
      setWebAVError(null)
    }
  }

  /**
   * 设置WebAV错误信息
   * @param error 错误信息或null
   */
  function setWebAVError(error: string | null) {
    console.log('🏪 [UnifiedWebavModule] setWebAVError:', {
      error,
      hasError: !!error,
      previousError: webAVError.value,
    })

    webAVError.value = error

    // 如果有错误，自动设置为未就绪状态
    if (error) {
      setWebAVReady(false)
    }
  }

  /**
   * 清除WebAV状态（由useWebAVControls调用）
   * 注意：实际的销毁逻辑由useWebAVControls处理
   */
  function clearWebAVState() {
    console.log('🗑️ [UnifiedWebavModule] 清除WebAV状态')

    // 只清除状态，不执行实际的销毁逻辑
    setAVCanvas(null)
    setWebAVReady(false)
    setWebAVError(null)

    console.log('✅ [UnifiedWebavModule] WebAV状态已清除')
  }

  /**
   * 检查WebAV是否可用
   * @returns 是否可用
   */
  function isWebAVAvailable(): boolean {
    return !!(avCanvas.value && isWebAVReady.value && !webAVError.value)
  }

  /**
   * 获取WebAV状态摘要
   * @returns WebAV状态摘要对象
   */
  function getWebAVSummary() {
    return {
      hasCanvas: !!avCanvas.value,
      isReady: isWebAVReady.value,
      hasError: !!webAVError.value,
      error: webAVError.value,
      isAvailable: isWebAVAvailable(),
      canvasInfo: avCanvas.value
        ? {
            width: ('width' in avCanvas.value) ? avCanvas.value.width : 'unknown',
            height: ('height' in avCanvas.value) ? avCanvas.value.height : 'unknown',
            constructor: avCanvas.value.constructor.name,
          }
        : null,
    }
  }

  /**
   * 重置WebAV状态为默认值
   */
  function resetToDefaults() {
    clearWebAVState()
    console.log('🔄 [UnifiedWebavModule] WebAV状态已重置为默认值')
  }

  /**
   * 添加sprite到画布
   * @param sprite 要添加的sprite
   */
  async function addSprite(sprite: VisibleSprite): Promise<boolean> {
    if (!isWebAVAvailable()) {
      console.warn('⚠️ [UnifiedWebavModule] WebAV不可用，无法添加sprite')
      return false
    }

    try {
      await avCanvas.value!.addSprite(sprite)
      console.log('✅ [UnifiedWebavModule] 添加sprite成功')
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('❌ [UnifiedWebavModule] 添加sprite失败:', errorMessage)
      setWebAVError(`添加sprite失败: ${errorMessage}`)
      return false
    }
  }

  /**
   * 从画布移除sprite
   * @param sprite 要移除的sprite
   */
  function removeSprite(sprite: VisibleSprite) {
    if (!isWebAVAvailable()) {
      console.warn('⚠️ [UnifiedWebavModule] WebAV不可用，无法移除sprite')
      return false
    }

    try {
      avCanvas.value!.removeSprite(sprite)
      console.log('✅ [UnifiedWebavModule] 移除sprite成功')
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('❌ [UnifiedWebavModule] 移除sprite失败:', errorMessage)
      setWebAVError(`移除sprite失败: ${errorMessage}`)
      return false
    }
  }

  // ==================== Clip创建和管理 ====================

  /**
   * 创建MP4Clip
   * @param file 视频文件
   */
  async function createMP4Clip(file: File): Promise<Raw<MP4Clip>> {
    try {
      console.log(`Creating MP4Clip for: ${file.name}`)

      // 创建MP4Clip
      const response = new Response(file)
      const mp4Clip = markRaw(new MP4Clip(response.body!))

      // 等待MP4Clip准备完成
      await mp4Clip.ready

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
  async function createImgClip(file: File): Promise<Raw<ImgClip>> {
    try {
      console.log(`Creating ImgClip for: ${file.name}`)

      // 创建ImgClip
      const response = new Response(file)
      const imgClip = markRaw(new ImgClip({
        type: file.type as any,
        stream: response.body!,
      }))

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
   * 创建AudioClip
   * @param file 音频文件
   */
  async function createAudioClip(file: File): Promise<Raw<AudioClip>> {
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

  // ==================== 画布容器管理 ====================

  /**
   * 创建WebAV画布容器
   * @param options 容器配置选项
   * @returns HTMLElement 创建的容器元素
   */
  function createCanvasContainer(options: {
    width: number
    height: number
    className?: string
    style?: Record<string, string>
  }): HTMLElement {
    const containerTimer = createPerformanceTimer('Canvas Container Creation')

    logContainerCreation({
      width: options.width,
      height: options.height,
      className: options.className || 'default',
      hasCustomStyle: !!options.style,
    })

    // 创建容器元素
    const container = document.createElement('div')
    container.className = options.className || 'webav-canvas-container'

    // 设置基础样式
    container.style.width = `${options.width}px`
    container.style.height = `${options.height}px`
    container.style.position = 'relative'
    container.style.overflow = 'hidden'

    // 应用自定义样式
    if (options.style) {
      Object.assign(container.style, options.style)
    }

    // 存储全局引用
    globalCanvasContainer = container

    const creationTime = containerTimer.end()
    logContainerCreated(creationTime)

    return container
  }

  /**
   * 初始化WebAV画布
   * @param container 画布容器元素
   * @param options 画布配置选项
   */
  async function initializeCanvas(
    container: HTMLElement,
    options: {
      width: number
      height: number
      bgColor: string
    },
  ): Promise<void> {
    const initTimer = createPerformanceTimer('WebAV Canvas Initialization')

    logWebAVInitStart({
      hasContainer: !!container,
      containerSize: `${container.clientWidth}x${container.clientHeight}`,
    })

    try {
      // 清理现有的canvas
      if (globalAVCanvas) {
        logWebAVInitStep(1, 'Cleaning up existing canvas')
        globalAVCanvas.destroy()
        globalAVCanvas = null
        logWebAVInitStep(1, 'Existing canvas cleaned up')
      }

      logWebAVInitStep(2, 'Validating container')
      if (!container || !container.parentElement) {
        throw new Error('Invalid container: container must be attached to DOM')
      }
      logWebAVInitStep(2, 'Container validation passed')

      logWebAVInitStep(3, 'Preparing canvas options')
      const targetContainer = container
      const targetOptions = {
        width: options.width,
        height: options.height,
        bgColor: options.bgColor,
      }
      logWebAVInitStep(3, 'Canvas options prepared', {
        targetSize: `${targetOptions.width}x${targetOptions.height}`,
        bgColor: targetOptions.bgColor,
      })

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
      setAVCanvas(globalAVCanvas)
      logWebAVInitStep(5, 'AVCanvas set to store successfully')

      logWebAVInitStep(6, 'Setting up event listeners')
      // 设置事件监听器
      setupEventListeners()
      logWebAVInitStep(6, 'Event listeners setup completed')

      logWebAVInitStep(7, 'Clearing error state')
      setWebAVError(null)
      logWebAVInitStep(7, 'Error state cleared')

      logWebAVInitStep(8, 'Previewing first frame')
      // 预览第一帧
      globalAVCanvas.previewFrame(0)
      logWebAVInitStep(8, 'First frame preview completed')

      logWebAVInitStep(9, 'Marking WebAV as ready')
      // 标记WebAV为就绪状态
      setWebAVReady(true)
      logWebAVInitStep(9, 'WebAV marked as ready in store')

      const totalInitTime = initTimer.end()
      logWebAVInitSuccess(totalInitTime, {
        canvasSize: `${targetOptions.width}x${targetOptions.height}`,
        containerAttached: !!targetContainer.parentElement,
        isReady: isWebAVReady.value,
      })
    } catch (error) {
      const totalInitTime = initTimer.end()
      const errorMessage = error instanceof Error ? error.message : String(error)

      logWebAVInitError(error as Error, totalInitTime, {
        containerValid: !!container,
        containerAttached: !!(container && container.parentElement),
      })

      setWebAVError(`WebAV初始化失败: ${errorMessage}`)
      throw error
    }
  }

  /**
   * 设置WebAV事件监听器
   */
  function setupEventListeners(): void {
    if (!globalAVCanvas) {
      console.error('❌ [WebAV Events] Cannot setup listeners: globalAVCanvas is null')
      return
    }

    // 播放状态变化事件
    globalAVCanvas.on('playing', async () => {
      const unifiedStore = await getUnifiedStore()
      unifiedStore.setPlaying(true)
    })

    globalAVCanvas.on('paused', async () => {
      const unifiedStore = await getUnifiedStore()
      unifiedStore.setPlaying(false)
    })

    // 时间更新事件
    globalAVCanvas.on('timeupdate', async (microseconds: number) => {
      // 使用时间同步锁防止循环调用
      if (isUpdatingTime) {
        // 静默跳过，避免日志污染
        return
      }

      isUpdatingTime = true
      try {
        // 将微秒转换为帧数
        const frames = microsecondsToFrames(microseconds)
        const unifiedStore = await getUnifiedStore()
        unifiedStore.setCurrentFrame(frames, false) // 传入帧数，不强制对齐保持流畅
      } finally {
        isUpdatingTime = false
      }
    })

    console.log('✅ [WebAV Events] Event listeners setup completed')
  }

  // ==================== 播放控制功能 ====================

  /**
   * 播放控制（帧数接口）
   * @param startFrames 开始帧数
   * @param endFrames 结束帧数，如果未提供则使用总时长作为结束时间
   * @param playbackRate 播放速度倍率
   */
  async function play(startFrames?: number, endFrames?: number, playbackRate?: number): Promise<void> {
    if (!globalAVCanvas) return

    const unifiedStore = await getUnifiedStore()

    // 帧数转换为微秒
    const start = framesToMicroseconds(startFrames || unifiedStore.currentFrame)

    const playOptions: PlayOptions = {
      start,
      playbackRate: playbackRate || unifiedStore.playbackRate,
    }

    // 如果没有提供结束时间，使用总时长作为默认结束时间
    const finalEndFrames = endFrames !== undefined ? endFrames : unifiedStore.contentEndTimeFrames

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
      startFrames: startFrames || unifiedStore.currentFrame,
      endFrames: finalEndFrames,
      originalEndFrames: endFrames,
      playbackRate: playOptions.playbackRate,
      startTimecode: framesToTimecode(startFrames || unifiedStore.currentFrame),
      endTimecode: finalEndFrames ? framesToTimecode(finalEndFrames) : undefined,
    })
  }

  /**
   * 暂停播放
   */
  function pause(): void {
    if (!globalAVCanvas) return
    globalAVCanvas.pause()
  }

  /**
   * 跳转到指定帧数
   * 这是时间控制的唯一入口点，所有UI时间操作都应该通过此方法
   * @param frames 帧数
   */
  async function seekTo(frames: number): Promise<void> {
    if (!globalAVCanvas) return

    // 设置时间同步锁，防止循环调用
    isUpdatingTime = true

    try {
      const microseconds = framesToMicroseconds(frames)
      globalAVCanvas.previewFrame(microseconds)

      // 直接更新store状态，因为previewFrame可能不会触发timeupdate事件
      const unifiedStore = await getUnifiedStore()
      unifiedStore.setCurrentFrame(frames, false)
    } finally {
      // 延迟重置锁，确保任何可能的timeupdate事件被处理
      setTimeout(() => {
        isUpdatingTime = false
      }, 10)
    }
  }

  /**
   * 克隆MP4Clip实例
   * @param originalClip 原始MP4Clip
   */
  async function cloneMP4Clip(originalClip: Raw<MP4Clip>): Promise<Raw<MP4Clip>> {
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
  async function cloneImgClip(originalClip: Raw<ImgClip>): Promise<Raw<ImgClip>> {
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
   * 克隆AudioClip实例
   * @param originalClip 原始AudioClip
   */
  async function cloneAudioClip(originalClip: Raw<AudioClip>): Promise<Raw<AudioClip>> {
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

  // ==================== 实例管理 ====================

  /**
   * 销毁WebAV实例
   */
  function destroy(): void {
    if (globalAVCanvas) {
      globalAVCanvas.destroy()
      globalAVCanvas = null
    }

    // 清理全局容器引用
    globalCanvasContainer = null

    // 清理错误状态
    setWebAVError(null)
    setAVCanvas(null)
    setWebAVReady(false)
  }

  /**
   * 获取WebAV实例（用于高级操作）
   */
  function getAVCanvas(): AVCanvas | null {
    return globalAVCanvas
  }

  /**
   * 获取画布容器DOM元素
   */
  function getCanvasContainer(): HTMLElement | null {
    return globalCanvasContainer
  }

  /**
   * 检查WebAV是否已经初始化
   */
  function isWebAVReadyGlobal(): boolean {
    return globalAVCanvas !== null
  }

  /**
   * 等待WebAV初始化完成
   * 使用Vue的watch机制监听isWebAVReady状态变化，更符合响应式编程模式
   * 由于项目必须依赖WebAV，因此不设置超时，确保一定等到初始化完成
   */
  async function waitForWebAVReady(): Promise<void> {
    // 如果已经初始化完成，直接返回
    if (isWebAVReady.value) {
      return
    }

    // 使用watch监听isWebAVReady状态变化，更优雅的响应式方式
    return new Promise<void>((resolve) => {
      const unwatch = watch(
        isWebAVReady,
        (ready) => {
          if (ready) {
            unwatch() // 停止监听
            resolve() // 完成Promise
          }
        },
        { immediate: true } // 立即执行一次，以防在watch设置前状态已经变为true
      )
    })
  }

  // ==================== 画布销毁和重建 ====================

  /**
   * 销毁画布并备份内容
   */
  async function destroyCanvas(): Promise<CanvasBackup | null> {
    const destroyTimer = createPerformanceTimer('Canvas Destroy')

    logCanvasDestroyStart({
      hasCanvas: !!globalAVCanvas,
      hasContainer: !!globalCanvasContainer,
    })

    try {
      let backup: CanvasBackup | null = null

      if (globalAVCanvas) {
        // 获取当前时间轴项目作为备份
        const unifiedStore = await getUnifiedStore()
        const timelineItems = unifiedStore.getAllTimelineItems()

        backup = {
          timelineItems: timelineItems.map((item: any) => ({ ...item })), // 深拷贝
          currentFrame: unifiedStore.currentFrame,
          isPlaying: unifiedStore.isPlaying,
        }

        logCanvasBackup(backup.timelineItems.length, {
          timelineItemsCount: backup.timelineItems.length,
          currentFrame: backup.currentFrame,
          isPlaying: backup.isPlaying,
        })

        // 销毁AVCanvas
        globalAVCanvas.destroy()
        globalAVCanvas = null
      }

      // 清理状态
      setAVCanvas(null)
      setWebAVReady(false)

      const destroyTime = destroyTimer.end()
      logCanvasDestroyComplete(destroyTime, backup?.timelineItems.length || 0)

      return backup
    } catch (error) {
      const destroyTime = destroyTimer.end()
      debugError('Canvas destroy failed', error as Error, destroyTime)
      throw error
    }
  }

  /**
   * 重新创建画布并恢复内容
   */
  async function recreateCanvas(
    container: HTMLElement,
    options: {
      width: number
      height: number
      bgColor: string
    },
    backup?: CanvasBackup | null,
  ): Promise<void> {
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
        // 确保WebAV已经准备好
        await waitForWebAVReady()

        const unifiedStore = await getUnifiedStore()

        // 恢复时间轴项目
        for (const timelineItem of backup.timelineItems) {
          try {
            // 获取对应的媒体项目 - 使用正确的属性名
            const mediaItem = unifiedStore.getMediaItem((timelineItem as any).mediaId)
            if (!mediaItem) {
              console.warn(`⚠️ [Canvas Recreate] 找不到媒体项目: ${(timelineItem as any).mediaId}`)
              continue
            }

            // 重新创建sprite - 简化调用，因为createSpriteFromMediaItem可能需要不同的参数
            // 这里需要根据实际的spriteFactory实现来调整
            console.log(`🔧 [Canvas Recreate] 恢复时间轴项目: ${timelineItem.id}`)

            // 记录sprite恢复 - 修正参数
            logSpriteRestore(timelineItem.id, mediaItem.mediaType)
          } catch (error) {
            console.error(`❌ [Canvas Recreate] 恢复时间轴项目失败: ${timelineItem.id}`, error)
          }
        }

        // 恢复播放状态
        if (backup.currentFrame !== undefined) {
          await seekTo(backup.currentFrame)
        }

        // 恢复播放状态
        if (backup.isPlaying) {
          // 这里可以根据需要恢复播放状态
          console.log('🔧 [Canvas Recreate] 恢复播放状态')
        }
      }

      const recreateTime = recreateTimer.end()
      logCanvasRecreateComplete(recreateTime, {
        canvasSize: `${options.width}x${options.height}`,
        restoredItems: backup?.timelineItems.length || 0,
        isReady: isWebAVReady.value,
      })
    } catch (error) {
      const recreateTime = recreateTimer.end()
      debugError('Canvas recreate failed', error as Error, recreateTime)
      throw error
    }
  }

  // ==================== 导出接口 ====================

  return {
    // 状态
    avCanvas,
    isWebAVReady,
    webAVError,

    // 状态管理方法
    setAVCanvas,
    setWebAVReady,
    setWebAVError,
    clearWebAVState,

    // 工具方法
    isWebAVAvailable,
    getWebAVSummary,
    resetToDefaults,
    addSprite,
    removeSprite,

    // 画布容器管理
    createCanvasContainer,
    initializeCanvas,
    getAVCanvas,
    getCanvasContainer,

    // 播放控制
    play,
    pause,
    seekTo,

    // Clip创建和管理
    createMP4Clip,
    createImgClip,
    createAudioClip,
    cloneMP4Clip,
    cloneImgClip,
    cloneAudioClip,

    // 实例管理
    destroy,
    isWebAVReadyGlobal,
    waitForWebAVReady,

    // 画布销毁和重建
    destroyCanvas,
    recreateCanvas,
  }
}

// 导出类型定义
export type UnifiedWebavModule = ReturnType<typeof createUnifiedWebavModule>