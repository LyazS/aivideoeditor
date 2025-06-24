import { useVideoStore } from '../stores/videoStore'
import type { DragPreviewData } from '../types/webavTypes'

// 统一拖拽预览管理器
class DragPreviewManager {
  private previewElement: HTMLElement | null = null
  private _videoStore: ReturnType<typeof useVideoStore> | null = null
  private updateTimer: number | null = null

  /**
   * 获取videoStore实例（延迟初始化）
   */
  private get videoStore() {
    if (!this._videoStore) {
      this._videoStore = useVideoStore()
    }
    return this._videoStore
  }

  /**
   * 显示拖拽预览
   */
  showPreview(data: DragPreviewData, timelineWidth: number) {
    this.hidePreview() // 先清理现有预览
    
    const preview = this.createPreviewElement(data)
    this.positionPreview(preview, data, timelineWidth)
    document.body.appendChild(preview)
    this.previewElement = preview
    
    console.log('🎨 [DragPreview] 显示预览:', data)
  }

  /**
   * 更新预览位置和状态
   */
  updatePreview(data: DragPreviewData, timelineWidth: number) {
    // 取消之前的更新
    if (this.updateTimer) {
      cancelAnimationFrame(this.updateTimer)
    }

    if (this.previewElement) {
      // 使用 requestAnimationFrame 优化性能，确保每帧只更新一次
      this.updateTimer = requestAnimationFrame(() => {
        if (this.previewElement) {
          this.positionPreview(this.previewElement, data, timelineWidth)
          this.updatePreviewStyle(this.previewElement, data)
          this.updatePreviewContent(this.previewElement, data)
        }
        this.updateTimer = null
      })
    } else {
      this.showPreview(data, timelineWidth)
    }
  }

  /**
   * 隐藏预览
   */
  hidePreview() {
    // 取消待处理的更新
    if (this.updateTimer) {
      cancelAnimationFrame(this.updateTimer)
      this.updateTimer = null
    }

    if (this.previewElement) {
      this.previewElement.remove()
      this.previewElement = null
    }
  }

  /**
   * 创建预览元素
   */
  private createPreviewElement(data: DragPreviewData): HTMLElement {
    const preview = document.createElement('div')
    preview.className = 'unified-drag-preview'
    
    // 基础样式 - 使用高性能的CSS属性，高度与clip一致
    preview.style.cssText = `
      position: fixed;
      left: 0;
      top: 0;
      height: 60px;
      background: ${data.isConflict ? 'rgba(255, 68, 68, 0.6)' : 'rgba(128, 128, 128, 0.6)'};
      border: 2px solid ${data.isConflict ? '#ff4444' : '#888888'};
      border-radius: 4px;
      pointer-events: none;
      z-index: 1001;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 11px;
      font-weight: 500;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      opacity: 0.9;
      will-change: transform;
    `
    
    // 设置内容
    this.updatePreviewContent(preview, data)
    
    return preview
  }

  /**
   * 更新预览内容
   */
  private updatePreviewContent(preview: HTMLElement, data: DragPreviewData) {
    if (data.isMultiple && data.count) {
      preview.textContent = `${data.count} 个项目`
    } else {
      const displayName = data.name.length > 12 ? data.name.substring(0, 10) + '..' : data.name
      preview.textContent = displayName
    }
  }

  /**
   * 定位预览元素
   */
  private positionPreview(preview: HTMLElement, data: DragPreviewData, timelineWidth: number) {
    // 计算预览位置和尺寸
    const left = this.videoStore.timeToPixel(data.startTime, timelineWidth)
    const right = this.videoStore.timeToPixel(data.startTime + data.duration, timelineWidth)
    const width = Math.max(right - left, 60) // 最小宽度60px

    // 获取目标轨道位置
    const trackSelector = `.track-content[data-track-id="${data.trackId}"]`
    const trackElement = document.querySelector(trackSelector) as HTMLElement

    if (trackElement) {
      const trackRect = trackElement.getBoundingClientRect()

      const finalLeft = trackRect.left + left
      const finalTop = trackRect.top + 10 // 与VideoClip的top: '10px'保持一致

      // 使用 transform 而不是 left/top 来提高性能
      preview.style.transform = `translate(${finalLeft}px, ${finalTop}px)`
      preview.style.width = `${width}px`

      // 只在第一次定位时设置 position
      if (!preview.style.position) {
        preview.style.position = 'fixed'
        preview.style.left = '0'
        preview.style.top = '0'
      }
    }
  }

  /**
   * 更新预览样式
   */
  private updatePreviewStyle(preview: HTMLElement, data: DragPreviewData) {
    // 更新冲突状态
    const borderColor = data.isConflict ? '#ff4444' : '#888888'
    const backgroundColor = data.isConflict 
      ? 'rgba(255, 68, 68, 0.6)' 
      : 'rgba(128, 128, 128, 0.6)'
    
    if (preview.style.borderColor !== borderColor) {
      preview.style.borderColor = borderColor
      preview.style.background = backgroundColor
    }
  }
}

// 全局实例变量
let _dragPreviewManager: DragPreviewManager | null = null

// 获取全局实例（延迟创建）
export function getDragPreviewManager(): DragPreviewManager {
  if (!_dragPreviewManager) {
    _dragPreviewManager = new DragPreviewManager()
  }
  return _dragPreviewManager
}

// 导出类型定义
export type { DragPreviewData }
