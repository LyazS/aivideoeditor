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
  private baseVideoSize: { width: number; height: number; x: number; y: number } | null = null
  private onPropsChangeCallback: ((transform: VideoTransform) => void) | null = null
  private onSpriteSelectCallback: ((clipId: string | null) => void) | null = null
  private onVideoMetaCallback: ((clipId: string, width: number, height: number) => void) | null = null
  private currentClipId: string | null = null
  private canvasWidth: number = 1920
  private canvasHeight: number = 1080

  constructor(container: HTMLElement) {
    this.container = container
    // 不在构造函数中初始化，改为在外部调用
  }

  /**
   * 设置画布尺寸
   */
  setCanvasSize(width: number, height: number) {
    this.canvasWidth = width
    this.canvasHeight = height
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

      // 创建实际的canvas容器，使用动态尺寸
      const canvasContainer = document.createElement('div')
      canvasContainer.style.cssText = `
        width: ${this.canvasWidth}px;
        height: ${this.canvasHeight}px;
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

      // 创建AVCanvas，使用动态尺寸
      this.avCanvas = new AVCanvas(canvasContainer, {
        width: this.canvasWidth,
        height: this.canvasHeight,
        bgColor: '#000000',
      })



      // 监听sprite选中状态变化
      this.avCanvas.on('activeSpriteChange', (activeSprite) => {
        if (this.onSpriteSelectCallback) {
          // 如果有活跃的sprite且是当前的sprite，选中对应的clip
          if (activeSprite === this.currentSprite && this.currentClipId) {
            this.onSpriteSelectCallback(this.currentClipId)
          } else if (!activeSprite) {
            // 如果没有活跃的sprite，取消选中
            this.onSpriteSelectCallback(null)
          }
        }
      })
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

    const targetAspectRatio = this.canvasWidth / this.canvasHeight // 使用动态宽高比
    const containerAspectRatio = containerWidth / containerHeight

    let canvasWidth, canvasHeight

    if (containerAspectRatio > targetAspectRatio) {
      // 容器比目标宽，以高度为准
      canvasHeight = Math.min(containerHeight * 0.9, this.canvasHeight)
      canvasWidth = canvasHeight * targetAspectRatio
    } else {
      // 容器比目标高，以宽度为准
      canvasWidth = Math.min(containerWidth * 0.9, this.canvasWidth)
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

      // 调用视频元数据回调，保存原始分辨率
      if (this.onVideoMetaCallback) {
        this.onVideoMetaCallback(clip.id, mp4Clip.meta.width, mp4Clip.meta.height)
      }

      // 创建VisibleSprite
      const sprite = new VisibleSprite(mp4Clip)

      // 设置视频在画布中的尺寸，保持原始宽高比
      this.setVideoSize(sprite, mp4Clip)

      // 应用变换属性
      this.applyTransform(sprite, clip)

      // 添加到画布
      await this.avCanvas.addSprite(sprite)

      // 监听sprite属性变化，同步回属性面板
      sprite.on('propsChange', (changedProps) => {
        if (this.onPropsChangeCallback && this.baseVideoSize) {
          // 将WebAV的sprite属性转换为我们的VideoTransform格式
          const transform = this.convertSpriteToTransform(sprite)
          this.onPropsChangeCallback(transform)
        }
      })

      // 保存引用
      this.currentClip = mp4Clip
      this.currentSprite = sprite
      this.currentClipId = clip.id
    } catch (error) {
      console.error('WebAV加载视频片段失败:', error)
      throw error
    }
  }

  /**
   * 设置视频在画布中的尺寸，使用原始分辨率作为基础
   */
  private setVideoSize(sprite: VisibleSprite, mp4Clip: MP4Clip) {
    try {
      const videoWidth = mp4Clip.meta.width
      const videoHeight = mp4Clip.meta.height



      // 直接使用视频原始尺寸作为基础尺寸（缩放1.0时的尺寸）
      const displayWidth = videoWidth
      const displayHeight = videoHeight

      // 设置sprite的尺寸为原始尺寸
      sprite.rect.w = displayWidth
      sprite.rect.h = displayHeight

      // WebAV使用画布中心为原点的坐标系统，所以位置(0,0)应该在画布中心
      // 当用户设置位置为(0,0)时，视频中心应该在画布中心
      sprite.rect.x = this.canvasWidth / 2 - displayWidth / 2
      sprite.rect.y = this.canvasHeight / 2 - displayHeight / 2

      // 保存基础尺寸和基础位置（画布中心对应的左上角坐标）
      this.baseVideoSize = {
        width: displayWidth,
        height: displayHeight,
        x: sprite.rect.x,  // 基础位置：视频左上角在画布中心时的坐标
        y: sprite.rect.y
      }



    } catch (error) {
      console.error('WebAV: 设置视频尺寸失败:', error)
      // 使用默认尺寸
      sprite.rect.w = 640
      sprite.rect.h = 360
      sprite.rect.x = (this.canvasWidth - 640) / 2
      sprite.rect.y = (this.canvasHeight - 360) / 2
    }
  }

  /**
   * 应用变换属性到sprite
   */
  private applyTransform(sprite: VisibleSprite, clip: VideoClip) {
    try {
      const { transform } = clip

      // 获取基础尺寸（由setVideoSize设置的正确比例）
      const baseWidth = this.baseVideoSize?.width || sprite.rect.w
      const baseHeight = this.baseVideoSize?.height || sprite.rect.h

      // 应用缩放（基于基础尺寸）
      const scaledWidth = baseWidth * transform.scaleX
      const scaledHeight = baseHeight * transform.scaleY
      sprite.rect.w = scaledWidth
      sprite.rect.h = scaledHeight

      // 应用位置变换（以画布中心为原点）
      // 用户的(0,0)对应画布中心，视频中心应该在画布中心
      const centerX = this.canvasWidth / 2
      const centerY = this.canvasHeight / 2

      // 计算视频左上角的位置：画布中心 + 用户偏移 - 视频尺寸的一半
      sprite.rect.x = centerX + transform.x - scaledWidth / 2
      sprite.rect.y = centerY + transform.y - scaledHeight / 2

      // 设置旋转（WebAV使用弧度）
      sprite.rect.angle = (transform.rotation * Math.PI) / 180

      // 设置透明度
      sprite.opacity = transform.opacity

      // 设置层级
      sprite.zIndex = clip.zIndex


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
   * 更新片段属性 - 新增方法用于实时属性同步
   * @param clip 要更新的片段
   */
  updateClipProperties(clip: VideoClip) {
    if (!this.avCanvas || this.isDestroyed || !this.currentSprite) return

    // 应用最新的变换属性
    this.applyTransform(this.currentSprite, clip)
  }

  /**
   * 设置属性变化回调函数
   * @param callback 当WebAV中的sprite属性变化时调用的回调函数
   */
  setPropsChangeCallback(callback: (transform: VideoTransform) => void) {
    this.onPropsChangeCallback = callback
  }

  /**
   * 设置sprite选中状态变化回调函数
   * @param callback 当WebAV中的sprite选中状态变化时调用的回调函数
   */
  setSpriteSelectCallback(callback: (clipId: string | null) => void) {
    this.onSpriteSelectCallback = callback
  }

  /**
   * 设置视频元数据回调函数
   * @param callback 当获取到视频原始分辨率时调用的回调函数
   */
  setVideoMetaCallback(callback: (clipId: string, width: number, height: number) => void) {
    this.onVideoMetaCallback = callback
  }

  /**
   * 设置当前sprite的选中状态
   * @param selected 是否选中
   */
  setCurrentSpriteSelected(selected: boolean) {
    if (!this.avCanvas || this.isDestroyed) return

    if (selected && this.currentSprite) {
      // 选中当前sprite
      this.avCanvas.activeSprite = this.currentSprite
    } else {
      // 取消选中
      this.avCanvas.activeSprite = null
    }
  }

  /**
   * 将WebAV的sprite属性转换为VideoTransform格式
   */
  private convertSpriteToTransform(sprite: VisibleSprite): VideoTransform {
    if (!this.baseVideoSize) {
      // 如果没有基础尺寸，返回默认值
      return {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 1
      }
    }

    // 计算缩放
    const scaleX = sprite.rect.w / this.baseVideoSize.width
    const scaleY = sprite.rect.h / this.baseVideoSize.height

    // 计算位置偏移（以画布中心为原点）
    // sprite.rect.x/y 是视频左上角的位置
    // 我们需要计算视频中心相对于画布中心的偏移
    const centerX = this.canvasWidth / 2
    const centerY = this.canvasHeight / 2

    // 视频中心位置 = 视频左上角 + 视频尺寸的一半
    const videoCenterX = sprite.rect.x + sprite.rect.w / 2
    const videoCenterY = sprite.rect.y + sprite.rect.h / 2

    // 相对于画布中心的偏移
    const x = videoCenterX - centerX
    const y = videoCenterY - centerY

    // 将弧度转换为角度
    const rotation = (sprite.rect.angle * 180) / Math.PI

    return {
      x: Math.round(x * 100) / 100, // 保留2位小数
      y: Math.round(y * 100) / 100,
      scaleX: Math.round(scaleX * 1000) / 1000, // 保留3位小数
      scaleY: Math.round(scaleY * 1000) / 1000,
      rotation: Math.round(rotation * 100) / 100,
      opacity: Math.round(sprite.opacity * 1000) / 1000
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
   * 获取WebAV的详细状态信息
   */
  getDetailedStatus() {
    if (!this.avCanvas || this.isDestroyed) {
      return {
        status: 'destroyed',
        message: 'WebAV渲染器已销毁或未初始化'
      }
    }

    const canvasElement = this.container.querySelector('canvas')

    return {
      status: 'active',
      canvas: {
        configured: { width: this.canvasWidth, height: this.canvasHeight },
        actual: canvasElement ? {
          width: canvasElement.width,
          height: canvasElement.height,
          clientWidth: canvasElement.clientWidth,
          clientHeight: canvasElement.clientHeight,
          style: {
            width: canvasElement.style.width,
            height: canvasElement.style.height
          }
        } : null
      },
      currentSprite: this.currentSprite ? {
        rect: {
          x: this.currentSprite.rect.x,
          y: this.currentSprite.rect.y,
          w: this.currentSprite.rect.w,
          h: this.currentSprite.rect.h,
          angle: this.currentSprite.rect.angle
        },
        opacity: this.currentSprite.opacity,
        zIndex: this.currentSprite.zIndex
      } : null,
      currentClip: this.currentClip ? {
        meta: this.currentClip.meta,
        duration: this.currentClip.meta.duration / 1e6 + '秒'
      } : null,
      baseVideoSize: this.baseVideoSize
    }
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
    

  }
}
