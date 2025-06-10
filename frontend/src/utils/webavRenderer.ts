import { AVCanvas } from '@webav/av-canvas'
import { VisibleSprite, MP4Clip } from '@webav/av-cliper'
import type { VideoClip } from '@/stores/counter'

/**
 * 基于WebAV SDK的视频渲染器
 * 替换原有的SingleVideoRenderer，保持相同的API接口以确保兼容性
 */
export class WebAVRenderer {
  private container: HTMLElement
  private avCanvas: AVCanvas | null = null
  private currentSprite: VisibleSprite | null = null
  private currentClip: MP4Clip | null = null
  private isDestroyed = false

  constructor(container: HTMLElement) {
    this.container = container
    // 不在构造函数中初始化，改为在外部调用
  }

  /**
   * 初始化AVCanvas
   */
  async initAVCanvas() {
    try {
      // 清空容器
      this.container.innerHTML = ''

      // 创建一个包装div来控制AVCanvas的尺寸和比例
      const canvasWrapper = document.createElement('div')
      canvasWrapper.style.cssText = `
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #2a2a2a;
      `

      // 创建实际的canvas容器，保持固定宽高比
      const canvasContainer = document.createElement('div')
      canvasContainer.style.cssText = `
        width: 800px;
        height: 450px;
        max-width: 100%;
        max-height: 100%;
        background: transparent;
        border-radius: 0;
        overflow: hidden;
      `

      // 计算合适的尺寸以保持宽高比
      this.updateCanvasSize(canvasContainer)

      canvasWrapper.appendChild(canvasContainer)
      this.container.appendChild(canvasWrapper)

      // 创建AVCanvas
      this.avCanvas = new AVCanvas(canvasContainer, {
        width: 800,
        height: 450,
        bgColor: '#000000',
      })

      console.log('WebAV AVCanvas 初始化成功')
    } catch (error) {
      console.error('WebAV AVCanvas 初始化失败:', error)
      throw error
    }
  }

  /**
   * 更新Canvas容器尺寸，保持宽高比
   */
  private updateCanvasSize(canvasContainer: HTMLElement) {
    const containerRect = this.container.getBoundingClientRect()
    const containerWidth = containerRect.width
    const containerHeight = containerRect.height

    const targetAspectRatio = 800 / 450 // 16:9 比例
    const containerAspectRatio = containerWidth / containerHeight

    let canvasWidth, canvasHeight

    if (containerAspectRatio > targetAspectRatio) {
      // 容器比目标宽，以高度为准
      canvasHeight = Math.min(containerHeight * 0.9, 450)
      canvasWidth = canvasHeight * targetAspectRatio
    } else {
      // 容器比目标高，以宽度为准
      canvasWidth = Math.min(containerWidth * 0.9, 800)
      canvasHeight = canvasWidth / targetAspectRatio
    }

    canvasContainer.style.width = `${canvasWidth}px`
    canvasContainer.style.height = `${canvasHeight}px`
    canvasContainer.style.borderRadius = '0' // 确保没有圆角

    // 查找并移除所有子元素的圆角
    const allElements = canvasContainer.querySelectorAll('*')
    allElements.forEach(element => {
      if (element instanceof HTMLElement) {
        element.style.borderRadius = '0'
      }
    })
  }

  /**
   * 设置视频文件 - 兼容原有API
   * @param videoElement 原有的video元素（为了兼容性保留，但不使用）
   */
  async setVideo(videoElement: HTMLVideoElement | null) {
    // 这个方法保留是为了兼容性，实际使用loadVideoClip方法
    console.log('WebAV渲染器: setVideo方法被调用，但WebAV使用不同的加载方式')
  }

  /**
   * 加载视频片段
   * @param clip 视频片段数据
   */
  async loadVideoClip(clip: VideoClip): Promise<void> {
    if (!this.avCanvas || this.isDestroyed) {
      console.warn('AVCanvas未初始化或已销毁')
      return
    }

    try {
      console.log('WebAV渲染器: 开始加载视频片段', clip.name)

      // 清理之前的sprite
      if (this.currentSprite) {
        await this.avCanvas.removeSprite(this.currentSprite)
        this.currentSprite = null
      }

      // 清理之前的clip
      if (this.currentClip) {
        this.currentClip.destroy()
        this.currentClip = null
      }

      // 创建MP4Clip
      let mp4Clip: MP4Clip
      if (clip.url && clip.file.size === 0) {
        // 使用URL创建（从媒体库拖拽的片段）
        const response = await fetch(clip.url)
        mp4Clip = new MP4Clip(response.body!)
      } else {
        // 使用文件创建（直接上传的文件）
        mp4Clip = new MP4Clip(clip.file.stream())
      }

      // 等待MP4Clip准备完成
      await mp4Clip.ready
      console.log('WebAV MP4Clip 准备完成:', mp4Clip.meta)

      // 创建VisibleSprite
      const sprite = new VisibleSprite(mp4Clip)

      // 设置视频在画布中的尺寸，保持原始宽高比
      this.setVideoSize(sprite, mp4Clip)

      // 应用变换属性
      this.applyTransform(sprite, clip)

      // 添加到画布
      await this.avCanvas.addSprite(sprite)

      // 保存引用
      this.currentClip = mp4Clip
      this.currentSprite = sprite

      console.log('WebAV视频片段加载完成')
    } catch (error) {
      console.error('WebAV加载视频片段失败:', error)
      throw error
    }
  }

  /**
   * 设置视频在画布中的尺寸，保持原始宽高比
   */
  private setVideoSize(sprite: VisibleSprite, mp4Clip: MP4Clip) {
    try {
      const videoWidth = mp4Clip.meta.width
      const videoHeight = mp4Clip.meta.height
      const canvasWidth = 800
      const canvasHeight = 450

      console.log('视频原始尺寸:', { width: videoWidth, height: videoHeight })
      console.log('画布尺寸:', { width: canvasWidth, height: canvasHeight })

      // 计算视频和画布的宽高比
      const videoAspect = videoWidth / videoHeight
      const canvasAspect = canvasWidth / canvasHeight

      let displayWidth, displayHeight

      if (videoAspect > canvasAspect) {
        // 视频比画布宽，以画布宽度为准
        displayWidth = Math.min(canvasWidth * 0.9, videoWidth)
        displayHeight = displayWidth / videoAspect
      } else {
        // 视频比画布高，以画布高度为准
        displayHeight = Math.min(canvasHeight * 0.9, videoHeight)
        displayWidth = displayHeight * videoAspect
      }

      // 设置sprite的尺寸
      sprite.rect.w = displayWidth
      sprite.rect.h = displayHeight

      // 居中显示
      sprite.rect.x = (canvasWidth - displayWidth) / 2
      sprite.rect.y = (canvasHeight - displayHeight) / 2

      console.log('计算后的显示尺寸:', {
        width: displayWidth,
        height: displayHeight,
        x: sprite.rect.x,
        y: sprite.rect.y,
        aspectRatio: displayWidth / displayHeight
      })

    } catch (error) {
      console.error('WebAV: 设置视频尺寸失败:', error)
      // 使用默认尺寸
      sprite.rect.w = 640
      sprite.rect.h = 360
      sprite.rect.x = (800 - 640) / 2
      sprite.rect.y = (450 - 360) / 2
    }
  }

  /**
   * 应用变换属性到sprite
   */
  private applyTransform(sprite: VisibleSprite, clip: VideoClip) {
    try {
      const { transform } = clip

      // 保存当前的尺寸和位置（由setVideoSize设置的正确比例）
      const currentW = sprite.rect.w
      const currentH = sprite.rect.h
      const currentX = sprite.rect.x
      const currentY = sprite.rect.y

      // 只有当transform有明确的位置设置时才覆盖
      if (transform.x !== undefined && transform.x !== 0) {
        sprite.rect.x = transform.x
      }
      if (transform.y !== undefined && transform.y !== 0) {
        sprite.rect.y = transform.y
      }

      // 应用缩放（基于当前正确的尺寸）
      if (transform.scaleX && transform.scaleX !== 1) {
        sprite.rect.w = currentW * transform.scaleX
      }
      if (transform.scaleY && transform.scaleY !== 1) {
        sprite.rect.h = currentH * transform.scaleY
      }

      // 设置旋转（WebAV使用弧度）
      if (transform.rotation) {
        sprite.rect.angle = (transform.rotation * Math.PI) / 180
      }

      // 设置透明度
      if (transform.opacity !== undefined) {
        sprite.opacity = transform.opacity
      }

      // 设置层级
      sprite.zIndex = clip.zIndex

      console.log('WebAV: 变换属性已应用', {
        position: { x: sprite.rect.x, y: sprite.rect.y },
        size: { w: sprite.rect.w, h: sprite.rect.h },
        rotation: sprite.rect.angle,
        opacity: sprite.opacity,
        zIndex: sprite.zIndex
      })
    } catch (error) {
      console.error('WebAV: 应用变换属性失败:', error)
    }
  }

  /**
   * 渲染视频帧 - 兼容原有API
   * @param clip 要渲染的片段
   */
  drawVideoFrame(clip: VideoClip | null) {
    if (!this.avCanvas || this.isDestroyed) return

    if (!clip) {
      // 清空画布
      this.clear()
      return
    }

    // WebAV的渲染是自动的，这里主要用于更新变换属性
    if (this.currentSprite && clip) {
      this.applyTransform(this.currentSprite, clip)
    }
  }

  /**
   * 清空画布
   */
  clear() {
    if (!this.avCanvas || this.isDestroyed) return
    
    // WebAV会自动清理，这里可以移除所有sprite
    if (this.currentSprite) {
      this.avCanvas.removeSprite(this.currentSprite)
      this.currentSprite = null
    }
  }

  /**
   * 调整画布尺寸
   */
  async resize(width: number, height: number) {
    if (this.isDestroyed) return

    // 查找canvas容器
    const canvasWrapper = this.container.querySelector('div')
    const canvasContainer = canvasWrapper?.querySelector('div')

    if (canvasContainer) {
      // 更新canvas容器尺寸，保持宽高比
      this.updateCanvasSize(canvasContainer as HTMLElement)
    } else {
      // 如果找不到容器，重新初始化
      if (this.avCanvas) {
        this.avCanvas.destroy()
        this.avCanvas = null
      }
      await this.initAVCanvas()
    }
  }

  /**
   * 播放控制
   */
  async play(options?: { start?: number; end?: number }) {
    if (!this.avCanvas || this.isDestroyed) return
    
    const start = options?.start || 0
    const end = options?.end || (this.currentClip?.meta.duration || 0)
    
    await this.avCanvas.play({ start, end })
  }

  /**
   * 暂停播放
   */
  pause() {
    if (!this.avCanvas || this.isDestroyed) return
    this.avCanvas.pause()
  }

  /**
   * 预览指定时间的帧
   */
  previewFrame(time: number) {
    if (!this.avCanvas || this.isDestroyed) return
    this.avCanvas.previewFrame(time)
  }

  /**
   * 获取AVCanvas实例（用于高级操作）
   */
  getAVCanvas(): AVCanvas | null {
    return this.avCanvas
  }

  /**
   * 销毁渲染器
   */
  destroy() {
    if (this.isDestroyed) return
    
    this.isDestroyed = true
    
    if (this.currentSprite) {
      this.currentSprite = null
    }
    
    if (this.currentClip) {
      this.currentClip.destroy()
      this.currentClip = null
    }
    
    if (this.avCanvas) {
      this.avCanvas.destroy()
      this.avCanvas = null
    }
    
    console.log('WebAV渲染器已销毁')
  }
}
