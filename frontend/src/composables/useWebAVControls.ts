import { ref, markRaw, toRaw } from 'vue'
import { AVCanvas } from '@webav/av-canvas'
import { MP4Clip } from '@webav/av-cliper'
import { CustomVisibleSprite } from '../utils/customVisibleSprite'
import { useVideoStore } from '../stores/counter'

// 全局WebAV状态 - 确保单例模式
let globalAVCanvas: AVCanvas | null = null
const globalMP4Clips = ref<Map<string, MP4Clip>>(new Map())
const globalCustomSprites = ref<Map<string, CustomVisibleSprite>>(new Map())
const globalIsCanvasReady = ref(false)
const globalError = ref<string | null>(null)

/**
 * WebAV控制器 - 管理AVCanvas和相关操作
 * 使用全局单例模式确保AVCanvas在整个应用中唯一
 */
export function useWebAVControls() {
  const videoStore = useVideoStore()

  /**
   * 初始化AVCanvas
   * @param container 容器元素
   * @param options 配置选项
   */
  const initializeCanvas = async (
    container: HTMLElement,
    options: {
      width: number
      height: number
      bgColor: string
    }
  ): Promise<void> => {
    try {
      // 如果已经初始化过，先销毁旧的实例
      if (globalAVCanvas) {
        console.log('Destroying existing WebAV Canvas...')
        globalAVCanvas.destroy()
        globalAVCanvas = null
      }

      console.log('Initializing WebAV Canvas...')

      // 创建AVCanvas实例 - 使用markRaw避免响应式包装
      globalAVCanvas = markRaw(new AVCanvas(container, options))

      // 设置事件监听器
      setupEventListeners()

      globalIsCanvasReady.value = true
      globalError.value = null

      // 预览第一帧
      globalAVCanvas.previewFrame(0)

      console.log('WebAV Canvas initialized successfully')
    } catch (err) {
      const errorMessage = `初始化WebAV画布失败: ${(err as Error).message}`
      globalError.value = errorMessage
      console.error('WebAV Canvas initialization error:', err)
      throw new Error(errorMessage)
    }
  }

  /**
   * 设置WebAV事件监听器
   */
  const setupEventListeners = (): void => {
    if (!globalAVCanvas) return

    // 播放状态变化事件
    globalAVCanvas.on('playing', () => {
      console.log('WebAV: Playing started')
      videoStore.isPlaying = true
    })

    globalAVCanvas.on('paused', () => {
      console.log('WebAV: Playing paused')
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
      console.log('WebAV: Active sprite changed', sprite)
      // 可以在这里处理选中状态的变化
    })
  }

  /**
   * 创建MP4Clip
   * @param file 视频文件
   * @param clipId 片段ID
   */
  const createMP4Clip = async (file: File, clipId: string): Promise<MP4Clip> => {
    try {
      console.log(`Creating MP4Clip for: ${file.name}`)
      
      // 创建MP4Clip
      const response = new Response(file)
      const mp4Clip = markRaw(new MP4Clip(response.body!))
      
      // 等待MP4Clip准备完成
      await mp4Clip.ready
      
      // 存储MP4Clip
      globalMP4Clips.value.set(clipId, mp4Clip)
      
      console.log(`MP4Clip created successfully for: ${file.name}`)
      return mp4Clip
    } catch (err) {
      const errorMessage = `创建MP4Clip失败: ${(err as Error).message}`
      console.error('MP4Clip creation error:', err)
      throw new Error(errorMessage)
    }
  }

  /**
   * 创建CustomVisibleSprite并添加到画布
   * @param clipId 片段ID
   * @param timelinePosition 时间轴位置（秒）
   * @param duration 持续时间（秒）
   */
  const createAndAddSprite = async (
    clipId: string,
    timelinePosition: number,
    duration: number
  ): Promise<CustomVisibleSprite> => {
    try {
      if (!globalAVCanvas) {
        throw new Error('AVCanvas未初始化')
      }

      const mp4Clip = globalMP4Clips.value.get(clipId)
      if (!mp4Clip) {
        throw new Error(`未找到MP4Clip: ${clipId}`)
      }

      console.log(`Creating CustomVisibleSprite for clip: ${clipId}`)

      // 等待MP4Clip的meta信息完全加载
      await mp4Clip.ready

      // 创建CustomVisibleSprite
      const sprite = markRaw(new CustomVisibleSprite(toRaw(mp4Clip)))

      // 设置时间范围（转换为微秒）
      const durationMicroseconds = mp4Clip.meta.duration
      const timelinePositionMicroseconds = timelinePosition * 1000000
      const durationInMicroseconds = duration * 1000000

      sprite.setTimeRange({
        clipStartTime: 0,
        clipEndTime: Math.min(durationInMicroseconds, durationMicroseconds),
        timelineStartTime: timelinePositionMicroseconds,
        timelineEndTime: timelinePositionMicroseconds + durationInMicroseconds
      })

      console.log('Sprite created, initial rect:', sprite.rect)

      // 先添加到canvas，让WebAV初始化sprite
      await globalAVCanvas.addSprite(sprite)

      console.log('Sprite added to canvas, rect after add:', sprite.rect)

      // 等待一下让sprite完全初始化
      await new Promise((resolve) => setTimeout(resolve, 200))

      // 现在设置sprite的位置和大小
      try {
        if (sprite.rect) {
          sprite.rect.x = (1920 - 640) / 2 // 居中
          sprite.rect.y = (1080 - 360) / 2 // 居中
          sprite.rect.w = Math.min(640, mp4Clip.meta.width)
          sprite.rect.h = Math.min(360, mp4Clip.meta.height)
          console.log('Sprite rect updated to:', sprite.rect)
        } else {
          console.warn('Sprite rect is still undefined after adding to canvas')
        }
      } catch (err) {
        console.warn('Failed to set sprite rect:', err)
      }

      // 存储sprite
      globalCustomSprites.value.set(clipId, sprite)

      console.log(`CustomVisibleSprite created and added for clip: ${clipId}`)
      return sprite
    } catch (err) {
      const errorMessage = `创建CustomVisibleSprite失败: ${(err as Error).message}`
      console.error('CustomVisibleSprite creation error:', err)
      throw new Error(errorMessage)
    }
  }

  /**
   * 移除精灵
   * @param clipId 片段ID
   */
  const removeSprite = async (clipId: string): Promise<void> => {
    try {
      if (!globalAVCanvas) return

      const sprite = globalCustomSprites.value.get(clipId)
      if (sprite) {
        await globalAVCanvas.removeSprite(toRaw(sprite))
        globalCustomSprites.value.delete(clipId)
        console.log(`Sprite removed for clip: ${clipId}`)
      }
    } catch (err) {
      console.error('Remove sprite error:', err)
    }
  }

  /**
   * 播放控制
   */
  const play = (startTime?: number, endTime?: number): void => {
    if (!globalAVCanvas || !globalIsCanvasReady.value) return

    const start = (startTime || videoStore.currentTime) * 1000000 // 转换为微秒
    const end = endTime ? endTime * 1000000 : undefined

    globalAVCanvas.play({
      start,
      end,
      playbackRate: videoStore.playbackRate
    })
  }

  /**
   * 暂停播放
   */
  const pause = (): void => {
    if (!globalAVCanvas || !globalIsCanvasReady.value) return
    globalAVCanvas.pause()
  }

  /**
   * 跳转到指定时间
   * @param time 时间（秒）
   */
  const seekTo = (time: number): void => {
    if (!globalAVCanvas || !globalIsCanvasReady.value) return

    const timeMicroseconds = time * 1000000
    globalAVCanvas.previewFrame(timeMicroseconds)
  }

  /**
   * 获取当前帧截图
   */
  const captureFrame = (): string | null => {
    if (!globalAVCanvas || !globalIsCanvasReady.value) return null
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

    // 清理存储的对象
    globalMP4Clips.value.clear()
    globalCustomSprites.value.clear()
    globalIsCanvasReady.value = false
    globalError.value = null
  }

  /**
   * 获取WebAV实例（用于高级操作）
   */
  const getAVCanvas = (): AVCanvas | null => {
    return globalAVCanvas
  }

  return {
    // 状态
    isCanvasReady: globalIsCanvasReady,
    error: globalError,
    mp4Clips: globalMP4Clips,
    customSprites: globalCustomSprites,

    // 方法
    initializeCanvas,
    createMP4Clip,
    createAndAddSprite,
    removeSprite,
    play,
    pause,
    seekTo,
    captureFrame,
    destroy,
    getAVCanvas
  }
}

/**
 * 检查WebAV是否已经初始化
 */
export function isWebAVReady(): boolean {
  return globalIsCanvasReady.value && globalAVCanvas !== null
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
