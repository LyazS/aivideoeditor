import { ref, markRaw, type Raw } from 'vue'
import { AVCanvas } from '@webav/av-canvas'
import { MP4Clip } from '@webav/av-cliper'
import { useVideoStore } from '../stores/counter'

// 全局WebAV状态 - 确保单例模式
let globalAVCanvas: AVCanvas | null = null
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
   * 播放控制
   */
  const play = (startTime?: number, endTime?: number): void => {
    if (!globalAVCanvas) return

    const start = (startTime || videoStore.currentTime) * 1000000 // 转换为微秒

    // 构建播放参数
    const playOptions: any = {
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

  return {
    // 状态
    error: globalError,

    // 方法
    initializeCanvas,
    createMP4Clip,
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
