import { ref, markRaw, type Raw } from 'vue'
import { AVCanvas } from '@webav/av-canvas'
import { MP4Clip } from '@webav/av-cliper'
import { CustomVisibleSprite } from '../utils/customVisibleSprite'
import { useVideoStore } from '../stores/videoStore'

// 定义播放选项接口
interface PlayOptions {
  start: number
  playbackRate: number
  end?: number
}

// 全局WebAV状态 - 确保单例模式
let globalAVCanvas: AVCanvas | null = null
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

      // 将AVCanvas实例设置到store中
      videoStore.setAVCanvas(globalAVCanvas)

      // 设置事件监听器
      setupEventListeners()

      globalError.value = null

      // 预览第一帧
      globalAVCanvas.previewFrame(0)

      // 标记WebAV为就绪状态
      videoStore.setWebAVReady(true)

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
      // 处理选中状态的变化 - 同步到时间轴选择
      // 类型断言：我们知道这里的sprite是CustomVisibleSprite或null
      videoStore.handleAVCanvasSpriteChange(sprite as CustomVisibleSprite | null)
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
   * 销毁当前画布并备份内容
   */
  const destroyCanvas = async (): Promise<CanvasBackup | null> => {
    if (!globalAVCanvas) {
      console.log('没有画布需要销毁')
      return null
    }

    console.log('开始销毁画布并备份内容...')

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

    console.log(`备份了 ${backup.sprites.length} 个sprites`)

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

      console.log('画布销毁完成')
      return backup
    } catch (error) {
      console.error('销毁画布时出错:', error)
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
    console.log('开始重新创建画布...')

    try {
      // 重新初始化画布
      await initializeCanvas(container, options)

      // 如果有备份内容，恢复sprites
      if (backup && backup.sprites.length > 0) {
        console.log(`开始恢复 ${backup.sprites.length} 个sprites...`)

        const avCanvas = getAVCanvas()
        if (!avCanvas) {
          throw new Error('画布重新创建失败')
        }

        // 恢复每个sprite
        for (const spriteBackup of backup.sprites) {
          try {
            // 克隆MP4Clip
            const clonedClip = await cloneMP4Clip(spriteBackup.clip)

            // 创建新的CustomVisibleSprite
            const newSprite = new CustomVisibleSprite(clonedClip)

            // 恢复时间范围设置
            const originalTimeRange = spriteBackup.sprite.getTimeRange()
            newSprite.setTimeRange(originalTimeRange)

            // 恢复变换属性
            const originalRect = spriteBackup.sprite.rect
            newSprite.rect.x = originalRect.x
            newSprite.rect.y = originalRect.y
            newSprite.rect.w = originalRect.w
            newSprite.rect.h = originalRect.h
            newSprite.zIndex = spriteBackup.sprite.zIndex
            newSprite.opacity = spriteBackup.sprite.opacity

            // 添加到画布
            await avCanvas.addSprite(newSprite)

            // 更新store中的引用
            videoStore.updateTimelineItemSprite(spriteBackup.timelineItemId, markRaw(newSprite))

            console.log(`恢复sprite成功: ${spriteBackup.timelineItemId}`)
          } catch (error) {
            console.error(`恢复sprite失败: ${spriteBackup.timelineItemId}`, error)
          }
        }

        // 恢复播放状态
        if (backup.isPlaying) {
          // 延迟一点再播放，确保所有sprite都已添加
          setTimeout(() => {
            play(backup.currentTime)
          }, 100)
        } else {
          // 跳转到备份的时间位置
          seekTo(backup.currentTime)
        }

        console.log('内容恢复完成')
      }

      console.log('画布重新创建完成')
    } catch (error) {
      console.error('重新创建画布失败:', error)
      throw error
    }
  }

  return {
    // 状态
    error: globalError,

    // 方法
    initializeCanvas,
    createMP4Clip,
    cloneMP4Clip,
    play,
    pause,
    seekTo,
    captureFrame,
    destroy,
    getAVCanvas,
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
