import type { VideoClip } from '@/stores/counter'

export class SingleVideoRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private video: HTMLVideoElement | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas')
    }
    this.ctx = ctx
  }

  // 设置视频元素
  setVideo(videoElement: HTMLVideoElement | null) {
    this.video = videoElement
  }

  // 清空画布
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    // 填充黑色背景
    this.ctx.fillStyle = '#000000'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
  }

  // 渲染视频帧，参考参考项目的实现
  drawVideoFrame(clip: VideoClip | null) {
    if (!this.video || !clip) {
      this.clear()
      return
    }

    // 检查视频是否准备好
    if (this.video.readyState < 1 || this.video.videoWidth === 0 || this.video.videoHeight === 0) {
      console.log('Video not ready for rendering:', {
        readyState: this.video.readyState,
        videoWidth: this.video.videoWidth,
        videoHeight: this.video.videoHeight
      })
      this.clear()
      return
    }

    this.clear()
    // console.log('Rendering video frame, readyState:', this.video.readyState) // 减少日志输出

    const { transform } = clip
    const centerX = this.canvas.width / 2
    const centerY = this.canvas.height / 2

    // 保存当前状态
    this.ctx.save()

    // 设置透明度
    this.ctx.globalAlpha = transform.opacity

    // 移动到画布中心并应用位置偏移
    this.ctx.translate(centerX + transform.x, centerY + transform.y)

    // 应用旋转
    if (transform.rotation !== 0) {
      this.ctx.rotate((transform.rotation * Math.PI) / 180)
    }

    // 应用缩放
    if (transform.scaleX !== 1 || transform.scaleY !== 1) {
      this.ctx.scale(transform.scaleX, transform.scaleY)
    }

    // 计算视频尺寸以适应画布并保持宽高比
    const videoAspect = this.video.videoWidth / this.video.videoHeight
    const canvasAspect = this.canvas.width / this.canvas.height

    let drawWidth = this.video.videoWidth
    let drawHeight = this.video.videoHeight

    if (videoAspect > canvasAspect) {
      // 视频比画布宽
      drawWidth = Math.min(this.canvas.width * 0.8, this.video.videoWidth)
      drawHeight = drawWidth / videoAspect
    } else {
      // 视频比画布高
      drawHeight = Math.min(this.canvas.height * 0.8, this.video.videoHeight)
      drawWidth = drawHeight * videoAspect
    }

    // 绘制视频（以中心为原点）
    this.ctx.drawImage(
      this.video,
      -drawWidth / 2,
      -drawHeight / 2,
      drawWidth,
      drawHeight
    )

    // 恢复状态
    this.ctx.restore()
  }

  // 调整画布尺寸
  resize(width: number, height: number) {
    this.canvas.width = width
    this.canvas.height = height
  }

  // 销毁渲染器
  destroy() {
    this.video = null
  }
}
