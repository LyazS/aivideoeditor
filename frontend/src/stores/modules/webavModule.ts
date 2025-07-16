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
} from '../utils/timeUtils'
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
 * WebAV集成管理模块
 * 负责管理WebAV相关的状态和方法
 *
 * 时间控制架构：
 * UI操作 → webAVModule.seekTo() → WebAV.previewFrame() → timeupdate事件 → videoStore.setCurrentTime()
 *
 * 重要原则：
 * 1. WebAV是时间状态的唯一权威源
 * 2. 所有UI时间操作都必须通过seekTo()方法
 * 3. 使用时间同步锁防止循环调用
 * 4. timeupdate事件是Store状态更新的唯一入口
 */
export function createWebAVModule() {
  // 延迟导入videoStore以避免循环依赖
  let videoStoreRef: any = null
  const getVideoStore = async () => {
    if (!videoStoreRef) {
      const { useVideoStore } = await import('../videoStore')
      videoStoreRef = useVideoStore()
    }
    return videoStoreRef
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
    console.log('🏪 [WebAVModule] setAVCanvas:', {
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
    console.log('🏪 [WebAVModule] setWebAVReady:', {
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
    console.log('🏪 [WebAVModule] setWebAVError:', {
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
    console.log('🗑️ [WebAVModule] 清除WebAV状态')

    // 只清除状态，不执行实际的销毁逻辑
    setAVCanvas(null)
    setWebAVReady(false)
    setWebAVError(null)

    console.log('✅ [WebAVModule] WebAV状态已清除')
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
    console.log('🔄 [WebAVModule] WebAV状态已重置为默认值')
  }

  /**
   * 添加sprite到画布
   * @param sprite 要添加的sprite
   */
  async function addSprite(sprite: VisibleSprite): Promise<boolean> {
    if (!isWebAVAvailable()) {
      console.warn('⚠️ [WebAVModule] WebAV不可用，无法添加sprite')
      return false
    }

    try {
      await avCanvas.value!.addSprite(sprite)
      console.log('✅ [WebAVModule] 添加sprite成功')
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('❌ [WebAVModule] 添加sprite失败:', errorMessage)
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
      console.warn('⚠️ [WebAVModule] WebAV不可用，无法移除sprite')
      return false
    }

    try {
      avCanvas.value!.removeSprite(sprite)
      console.log('✅ [WebAVModule] 移除sprite成功')
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('❌ [WebAVModule] 移除sprite失败:', errorMessage)
      setWebAVError(`移除sprite失败: ${errorMessage}`)
      return false
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
      const videoStore = await getVideoStore()
      videoStore.isPlaying = true
    })

    globalAVCanvas.on('paused', async () => {
      const videoStore = await getVideoStore()
      videoStore.isPlaying = false
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
        const videoStore = await getVideoStore()
        videoStore.setCurrentFrame(frames, false) // 传入帧数，不强制对齐保持流畅
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

    const videoStore = await getVideoStore()

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
      const videoStore = await getVideoStore()
      videoStore.setCurrentFrame(frames, false)
    } finally {
      // 延迟重置锁，确保任何可能的timeupdate事件被处理
      setTimeout(() => {
        isUpdatingTime = false
      }, 10)
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
    const destroyTimer = createPerformanceTimer('Canvas Destruction')

    if (!globalAVCanvas) {
      console.warn('⚠️ [WebAV Module] No canvas to destroy')
      return null
    }

    const videoStore = await getVideoStore()

    // 创建备份对象
    const backup: CanvasBackup = {
      timelineItems: videoStore.timelineItems.map((item: any) => ({
        ...item,
        // 确保包含所有必要的数据用于重建
      })),
      isPlaying: videoStore.isPlaying,
      currentFrame: videoStore.currentFrame,
    }

    logCanvasDestroyStart({
      timelineItems: backup.timelineItems.length,
    })

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
      setAVCanvas(null)
      setWebAVReady(false)

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

        const videoStore = await getVideoStore()

        // 导入工厂函数
        const { createSpriteFromMediaItem } = await import('../../utils/spriteFactory')

        // 恢复每个时间轴项目
        let restoredCount = 0
        for (const itemData of backup.timelineItems) {
          try {
            logSpriteRestore(
              itemData.id,
              `Restoring timeline item ${restoredCount + 1}/${backup.timelineItems.length}`,
            )

            // 从原始素材重新创建sprite
            const mediaItem = videoStore.getLocalMediaItem(itemData.mediaItemId)
            if (!mediaItem) {
              throw new Error(`Media item not found: ${itemData.mediaItemId}`)
            }

            const newSprite = await createSpriteFromMediaItem(mediaItem)
            logSpriteRestore(itemData.id, 'Sprite created from media item')

            // 恢复时间范围设置
            newSprite.setTimeRange(itemData.timeRange)
            logSpriteRestore(itemData.id, 'Time range restored', itemData.timeRange)

            // 恢复变换属性 - 需要处理新旧画布分辨率不同的情况
            if (itemData.mediaType === 'video' || itemData.mediaType === 'image') {
              const { projectToWebavCoords } = await import('../../utils/coordinateTransform')
              const { hasVisualPropsData } = await import('../../types')

              // 类型安全的配置访问
              if (!hasVisualPropsData(itemData)) {
                console.warn('🎨 [WebAV Module] Item does not have visual properties:', itemData.mediaType)
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

              logCoordinateTransform(itemData.id, {
                original: { x: config.x, y: config.y, width: config.width, height: config.height },
                transformed: newWebavCoords,
                canvasSize: `${options.width}x${options.height}`,
              })

              // 应用变换
              newSprite.rect.x = newWebavCoords.x
              newSprite.rect.y = newWebavCoords.y
              newSprite.rect.w = config.width
              newSprite.rect.h = config.height
              newSprite.rect.angle = (config as any).angle || 0
              newSprite.opacity = (config as any).opacity !== undefined ? (config as any).opacity : 1
              newSprite.zIndex = (config as any).zIndex || 0

              logSpriteRestore(itemData.id, 'Transform properties restored')
            }

            // 添加到画布
            await addSprite(newSprite)
            logSpriteRestore(itemData.id, 'Added to canvas')

            // 更新store中的引用
            videoStore.updateLocalTimelineItemSprite(itemData.id, markRaw(newSprite))
            logSpriteRestore(itemData.id, 'Store reference updated')

            // 重新设置双向数据同步
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

        console.log(`✅ Canvas recreation completed: ${restoredCount}/${backup.timelineItems.length} items restored`)
      }

      const recreateTime = recreateTimer.end()
      logCanvasRecreateComplete(recreateTime, backup?.timelineItems.length || 0)
    } catch (error) {
      const recreateTime = recreateTimer.end()
      debugError('Canvas recreation failed', error as Error, {
        recreateTime: `${recreateTime.toFixed(2)}ms`,
        hasBackup: !!backup,
        backupItems: backup?.timelineItems.length || 0,
      })
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
export type WebAVModule = ReturnType<typeof createWebAVModule>
