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
    const { data, isSelected, currentFrame, scale } = context

    // 判断是否应该显示详细信息（与旧架构逻辑一致）
    const showDetails = this.shouldShowDetails(context)

    return h(
      'div',
      {
        class: ['video-content', { selected: isSelected }],
        style: this.getContentStyles(),
      },
      [
        // 只在showDetails时显示缩略图（与旧架构一致）
        showDetails ? this.renderThumbnail(data, currentFrame) : null,
        // 内容信息覆盖层
        showDetails ? this.renderDetailedInfo(data) : this.renderSimpleInfo(data),
        // 裁剪指示器
        this.renderClipIndicators(data),
      ],
    )
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

  getCustomStyles(
    context: ContentRenderContext<'video' | 'image'>,
  ): Record<string, string | number> {
    // 不覆盖背景色，让UnifiedTimelineClip的统一样式生效
    return {}
  }

  // ==================== 私有方法 ====================

  /**
   * 判断是否应该显示详细信息（与旧架构逻辑一致）
   */
  private shouldShowDetails(context: ContentRenderContext<'video' | 'image'>): boolean {
    const { data, scale } = context

    // 计算clip的像素宽度
    const durationFrames = data.timeRange.timelineEndTime - data.timeRange.timelineStartTime
    const width = durationFrames * scale // 简化计算，实际可能需要更复杂的逻辑

    return width >= 100 // 宽度大于100px时显示详细信息
  }

  /**
   * 获取内容样式
   */
  private getContentStyles(): Record<string, string> {
    return {
      display: 'flex',
      alignItems: 'center',
      height: '100%',
      padding: '4px 8px',
      overflow: 'hidden',
    }
  }

  /**
   * 渲染缩略图
   */
  private renderThumbnail(
    data: UnifiedTimelineItemData<'video' | 'image'>,
    currentFrame: number,
  ): VNode {
    const thumbnailUrl = this.getThumbnailUrl(data, currentFrame)

    if (thumbnailUrl) {
      return h(
        'div',
        {
          class: 'clip-thumbnail',
          style: this.getThumbnailContainerStyles(),
        },
        [
          h('img', {
            class: 'thumbnail-image',
            src: thumbnailUrl,
            alt: getTimelineItemDisplayName(data),
            style: this.getThumbnailImageStyles(),
            onError: () => this.handleThumbnailError(data),
            onLoad: () => this.handleThumbnailLoad(data),
          }),
        ],
      )
    }

    // 如果没有缩略图，显示占位符
    return this.renderThumbnailPlaceholder(data)
  }

  /**
   * 渲染缩略图占位符
   */
  private renderThumbnailPlaceholder(data: UnifiedTimelineItemData<'video' | 'image'>): VNode {
    return h(
      'div',
      {
        class: 'clip-thumbnail',
        style: this.getThumbnailContainerStyles(),
      },
      [
        h(
          'div',
          {
            class: 'thumbnail-placeholder',
            style: this.getThumbnailPlaceholderStyles(),
          },
          [h('div', { class: 'loading-spinner', style: this.getLoadingSpinnerStyles() })],
        ),
      ],
    )
  }

  /**
   * 渲染详细信息（与旧架构的clip-info一致）
   */
  private renderDetailedInfo(data: UnifiedTimelineItemData<'video' | 'image'>): VNode {
    return h(
      'div',
      {
        class: 'clip-info',
        style: this.getClipInfoStyles(),
      },
      [
        // 文件名
        h(
          'div',
          {
            class: 'clip-name',
            style: this.getClipNameStyles(),
          },
          getTimelineItemDisplayName(data),
        ),
        // 时长信息
        h(
          'div',
          {
            class: 'clip-duration',
            style: this.getClipDurationStyles(),
          },
          this.formatTime(this.getDuration(data)),
        ),
        // 倍速信息（仅视频）
        data.mediaType === 'video' &&
        this.hasSpeedAdjustment(data as UnifiedTimelineItemData<'video'>)
          ? h(
              'div',
              {
                class: 'clip-speed',
                style: this.getClipSpeedStyles(),
              },
              this.getSpeedText(data as UnifiedTimelineItemData<'video'>),
            )
          : null,
      ],
    )
  }

  /**
   * 渲染简化信息（与旧架构的clip-simple一致）
   */
  private renderSimpleInfo(data: UnifiedTimelineItemData<'video' | 'image'>): VNode {
    return h(
      'div',
      {
        class: 'clip-simple',
        style: this.getClipSimpleStyles(),
      },
      [
        h(
          'div',
          {
            class: 'simple-duration',
            style: this.getSimpleDurationStyles(),
          },
          this.formatTime(this.getDuration(data)),
        ),
      ],
    )
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
      this.hasRightClipping(data) && h('div', { class: 'clip-indicator clip-right' }, '▶'),
    ])
  }

  // ==================== 样式方法 ====================

  /**
   * 获取缩略图容器样式（与旧架构.clip-thumbnail一致）
   */
  private getThumbnailContainerStyles(): Record<string, string> {
    return {
      width: '50px',
      height: '32px',
      backgroundColor: 'var(--color-bg-primary)',
      borderRadius: '2px',
      overflow: 'hidden',
      position: 'relative',
      flexShrink: '0',
    }
  }

  /**
   * 获取缩略图图片样式
   */
  private getThumbnailImageStyles(): Record<string, string> {
    return {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    }
  }

  /**
   * 获取缩略图占位符样式
   */
  private getThumbnailPlaceholderStyles(): Record<string, string> {
    return {
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
    }
  }

  /**
   * 获取加载旋转器样式
   */
  private getLoadingSpinnerStyles(): Record<string, string> {
    return {
      width: '16px',
      height: '16px',
      border: '2px solid rgba(255, 255, 255, 0.3)',
      borderTop: '2px solid var(--color-text-primary)',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
    }
  }

  /**
   * 获取clip-info样式
   */
  private getClipInfoStyles(): Record<string, string> {
    return {
      flex: '1',
      marginLeft: '6px',
      minWidth: '0',
    }
  }

  /**
   * 获取clip-name样式
   */
  private getClipNameStyles(): Record<string, string> {
    return {
      fontSize: '11px',
      fontWeight: 'bold',
      color: 'white',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }
  }

  /**
   * 获取clip-duration样式
   */
  private getClipDurationStyles(): Record<string, string> {
    return {
      fontSize: '9px',
      color: 'rgba(255, 255, 255, 0.8)',
      marginTop: '1px',
    }
  }

  /**
   * 获取clip-speed样式
   */
  private getClipSpeedStyles(): Record<string, string> {
    return {
      fontSize: '9px',
      color: 'var(--color-speed-indicator)',
      marginTop: '1px',
      fontWeight: 'bold',
    }
  }

  /**
   * 获取clip-simple样式
   */
  private getClipSimpleStyles(): Record<string, string> {
    return {
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
    }
  }

  /**
   * 获取simple-duration样式
   */
  private getSimpleDurationStyles(): Record<string, string> {
    return {
      fontSize: '10px',
      fontWeight: 'bold',
      color: 'white',
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      padding: '2px 4px',
      borderRadius: '2px',
      whiteSpace: 'nowrap',
    }
  }

  // ==================== 辅助方法 ====================

  /**
   * 获取缩略图URL
   */
  private getThumbnailUrl(
    data: UnifiedTimelineItemData<'video' | 'image'>,
    currentFrame: number,
  ): string | null {
    // 优先从runtime中获取缩略图URL
    if (data.runtime.thumbnailUrl) {
      return data.runtime.thumbnailUrl
    }

    // 兼容性检查：检查配置中是否有thumbnailUrl（向后兼容）
    const config = data.config as any
    if (config && config.thumbnailUrl) {
      return config.thumbnailUrl
    }

    // 兼容性检查：检查是否有直接的thumbnailUrl属性（与旧架构兼容）
    if ('thumbnailUrl' in data && (data as any).thumbnailUrl) {
      return (data as any).thumbnailUrl
    }

    // 如果没有缩略图URL，返回null显示占位符
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
   * 格式化时间显示（使用时间码格式，与旧架构一致）
   */
  private formatTime(frames: number): string {
    // 使用时间码格式：HH:MM:SS:FF
    const fps = 30 // 假设30fps
    const totalSeconds = Math.floor(frames / fps)
    const remainingFrames = frames % fps

    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${remainingFrames.toString().padStart(2, '0')}`
    } else {
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${remainingFrames.toString().padStart(2, '0')}`
    }
  }

  /**
   * 检查是否有播放速度调整（仅适用于视频）
   */
  private hasSpeedAdjustment(data: UnifiedTimelineItemData<'video'>): boolean {
    if (data.runtime.sprite && 'getPlaybackRate' in data.runtime.sprite) {
      try {
        // 类型断言：我们知道这是video类型的sprite，应该有getPlaybackRate方法
        const sprite = data.runtime.sprite as any
        const playbackRate = sprite.getPlaybackRate()
        return Math.abs(playbackRate - 1.0) > 0.01
      } catch (error) {
        console.warn(`获取播放速度失败: ${data.id}`, error)
        return false
      }
    }
    return false
  }

  /**
   * 获取播放速度文本（仅适用于视频）
   */
  private getSpeedText(data: UnifiedTimelineItemData<'video'>): string {
    if (data.runtime.sprite && 'getPlaybackRate' in data.runtime.sprite) {
      try {
        // 类型断言：我们知道这是video类型的sprite，应该有getPlaybackRate方法
        const sprite = data.runtime.sprite as any
        const playbackRate = sprite.getPlaybackRate()
        if (Math.abs(playbackRate - 1.0) <= 0.01) {
          return '正常速度'
        } else {
          return `${playbackRate.toFixed(1)}x`
        }
      } catch (error) {
        console.warn(`获取播放速度失败: ${data.id}`, error)
        return '正常速度'
      }
    }
    return '正常速度'
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
