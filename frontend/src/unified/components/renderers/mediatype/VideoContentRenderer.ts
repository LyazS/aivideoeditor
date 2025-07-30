/**
 * 视频内容渲染器
 * 处理ready状态下视频和图片类型的内容渲染
 * 
 * 设计理念：
 * - 统一处理视频和图片类型的显示
 * - 提供缩略图预览和时间信息
 * - 支持裁剪指示器和播放状态
 * - 优化视觉效果和用户体验
 */

import { h } from 'vue'
import type { VNode } from 'vue'
import type { ContentRenderer, ContentRenderContext } from '../../../types/clipRenderer'
import type { UnifiedTimelineItemData } from '../../../timelineitem/TimelineItemData'
import { getTimelineItemDisplayName } from '../../../utils/clipUtils'

/**
 * 视频内容渲染器
 */
export class VideoContentRenderer implements ContentRenderer<'video' | 'image'> {
  readonly type = 'video' as const

  renderContent(context: ContentRenderContext<'video' | 'image'>): VNode {
    const { data, isSelected, currentFrame } = context

    return h('div', {
      class: ['video-content', { selected: isSelected }]
    }, [
      // 缩略图显示
      this.renderThumbnail(data, currentFrame),
      // 内容信息覆盖层
      this.renderContentOverlay(data),
      // 裁剪指示器
      this.renderClipIndicators(data)
    ])
  }

  getCustomClasses(context: ContentRenderContext<'video' | 'image'>): string[] {
    const { data } = context
    const classes = ['video-renderer']

    // 添加媒体类型特定的类
    classes.push(`media-${data.mediaType}`)

    // 添加状态相关的类
    if (this.hasClipping(data)) {
      classes.push('has-clipping')
    }

    return classes
  }

  getCustomStyles(context: ContentRenderContext<'video' | 'image'>): Record<string, string | number> {
    const { data } = context
    const styles: Record<string, string | number> = {}

    // 根据媒体类型设置不同的背景
    if (data.mediaType === 'video') {
      styles.background = 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)'
    } else if (data.mediaType === 'image') {
      styles.background = 'linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%)'
    }

    return styles
  }

  // ==================== 私有方法 ====================

  /**
   * 渲染缩略图
   */
  private renderThumbnail(data: UnifiedTimelineItemData<'video' | 'image'>, currentFrame: number): VNode {
    const thumbnailUrl = this.getThumbnailUrl(data, currentFrame)
    
    if (thumbnailUrl) {
      return h('div', { class: 'thumbnail-container' }, [
        h('img', {
          class: 'thumbnail-image',
          src: thumbnailUrl,
          alt: getTimelineItemDisplayName(data),
          onError: () => this.handleThumbnailError(data),
          onLoad: () => this.handleThumbnailLoad(data)
        })
      ])
    }

    // 如果没有缩略图，显示占位符
    return this.renderThumbnailPlaceholder(data)
  }

  /**
   * 渲染缩略图占位符
   */
  private renderThumbnailPlaceholder(data: UnifiedTimelineItemData<'video' | 'image'>): VNode {
    const iconMap = {
      video: '🎬',
      image: '🖼️'
    }

    return h('div', { class: 'thumbnail-placeholder' }, [
      h('div', { class: 'placeholder-icon' }, iconMap[data.mediaType]),
      h('div', { class: 'placeholder-text' }, data.mediaType === 'video' ? '视频' : '图片')
    ])
  }

  /**
   * 渲染内容覆盖层
   */
  private renderContentOverlay(data: UnifiedTimelineItemData<'video' | 'image'>): VNode {
    return h('div', { class: 'content-overlay' }, [
      // 媒体类型标识
      this.renderMediaTypeIndicator(data),
      // 时间显示
      this.renderTimeDisplay(data),
      // 文件名显示
      this.renderFileName(data)
    ])
  }

  /**
   * 渲染媒体类型指示器
   */
  private renderMediaTypeIndicator(data: UnifiedTimelineItemData<'video' | 'image'>): VNode {
    const iconMap = {
      video: '▶️',
      image: '🖼️'
    }

    return h('div', { 
      class: ['media-type-indicator', `type-${data.mediaType}`] 
    }, iconMap[data.mediaType])
  }

  /**
   * 渲染时间显示
   */
  private renderTimeDisplay(data: UnifiedTimelineItemData<'video' | 'image'>): VNode {
    const duration = this.getDuration(data)
    const timeText = this.formatTime(duration)

    return h('div', { class: 'time-display' }, [
      h('span', { class: 'time-text' }, timeText)
    ])
  }

  /**
   * 渲染文件名
   */
  private renderFileName(data: UnifiedTimelineItemData<'video' | 'image'>): VNode {
    const name = getTimelineItemDisplayName(data)
    const displayName = name.length > 12 ? name.substring(0, 12) + '...' : name

    return h('div', { class: 'file-name' }, [
      h('span', { class: 'name-text' }, displayName)
    ])
  }

  /**
   * 渲染裁剪指示器
   */
  private renderClipIndicators(data: UnifiedTimelineItemData<'video' | 'image'>): VNode | null {
    if (!this.hasClipping(data)) {
      return null
    }

    return h('div', { class: 'clip-indicators' }, [
      // 左侧裁剪指示器
      this.hasLeftClipping(data) && h('div', { class: 'clip-indicator clip-left' }, '◀'),
      // 右侧裁剪指示器
      this.hasRightClipping(data) && h('div', { class: 'clip-indicator clip-right' }, '▶')
    ])
  }

  // ==================== 辅助方法 ====================

  /**
   * 获取缩略图URL
   */
  private getThumbnailUrl(data: UnifiedTimelineItemData<'video' | 'image'>, currentFrame: number): string | null {
    // 这里需要通过mediaItemId获取关联的媒体项目数据来获取缩略图
    // 暂时返回null，实际实现需要从store或管理器中获取
    return null
  }

  /**
   * 获取持续时间
   */
  private getDuration(data: UnifiedTimelineItemData<'video' | 'image'>): number {
    // 计算时间轴项目的持续时间（帧数）
    return data.timeRange.timelineEndTime - data.timeRange.timelineStartTime
  }

  /**
   * 格式化时间显示
   */
  private formatTime(frames: number): string {
    // 假设30fps
    const seconds = frames / 30
    
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`
    }
    
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  /**
   * 检查是否有裁剪
   */
  private hasClipping(data: UnifiedTimelineItemData<'video' | 'image'>): boolean {
    // 这里需要检查媒体项目的原始时长与时间轴项目时长的关系
    // 暂时返回false，实际实现需要获取媒体项目数据
    return false
  }

  /**
   * 检查是否有左侧裁剪
   */
  private hasLeftClipping(data: UnifiedTimelineItemData<'video' | 'image'>): boolean {
    // 检查是否从媒体的中间开始播放
    return false
  }

  /**
   * 检查是否有右侧裁剪
   */
  private hasRightClipping(data: UnifiedTimelineItemData<'video' | 'image'>): boolean {
    // 检查是否在媒体结束前停止
    return false
  }

  /**
   * 处理缩略图加载错误
   */
  private handleThumbnailError(data: UnifiedTimelineItemData<'video' | 'image'>): void {
    console.warn(`缩略图加载失败: ${data.id}`)
  }

  /**
   * 处理缩略图加载成功
   */
  private handleThumbnailLoad(data: UnifiedTimelineItemData<'video' | 'image'>): void {
    console.log(`缩略图加载成功: ${data.id}`)
  }
}
