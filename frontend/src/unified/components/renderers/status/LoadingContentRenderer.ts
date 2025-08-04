/**
 * 加载状态内容渲染器
 * 处理所有loading状态的内容渲染，包括异步处理和普通加载
 *
 * 设计理念：
 * - 统一处理所有loading状态的显示
 * - 根据媒体类型和具体状态渲染不同内容
 * - 支持进度显示和状态指示
 * - 提供丰富的视觉反馈
 */

import { h } from 'vue'
import type { VNode } from 'vue'
import type { ContentRenderer, ContentRenderContext } from '../../../types/clipRenderer'
import type { UnifiedTimelineItemData } from '../../../timelineitem/TimelineItemData'
import type { MediaTypeOrUnknown } from '../../../mediaitem/types'
import type { UnifiedMediaItemData } from '../../../mediaitem/types'
import { getTimelineItemDisplayName } from '../../../utils/clipUtils'

/**
 * 加载状态内容渲染器
 */
export class LoadingContentRenderer implements ContentRenderer<MediaTypeOrUnknown> {
  readonly type = 'loading' as const

  renderContent(context: ContentRenderContext<MediaTypeOrUnknown>): VNode {
    const { data, isSelected } = context

    return h(
      'div',
      {
        class: ['loading-content', { selected: isSelected }],
      },
      [
        // 根据媒体类型和具体状态渲染不同内容
        data.mediaType === 'unknown'
          ? this.renderAsyncProcessing(context)
          : this.renderNormalLoading(context),
      ],
    )
  }

  renderStatusIndicator(context: ContentRenderContext<MediaTypeOrUnknown>): VNode {
    return h(
      'div',
      {
        class: 'loading-status-indicator',
      },
      [this.renderLoadingSpinner()],
    )
  }

  renderProgressBar(context: ContentRenderContext<MediaTypeOrUnknown>): VNode | null {
    const { data } = context
    const progressInfo = this.getProgressInfo(data)

    if (!progressInfo.hasProgress) {
      return null
    }

    return h('div', { class: 'loading-progress-bar' }, [
      h('div', {
        class: 'progress-fill',
        style: {
          width: `${progressInfo.percent}%`,
          transition: 'width 0.3s ease',
        },
      }),
      // 进度文本
      h(
        'div',
        {
          class: 'progress-text',
        },
        `${Math.round(progressInfo.percent)}%`,
      ),
    ])
  }

  getCustomClasses(context: ContentRenderContext<MediaTypeOrUnknown>): string[] {
    const { data } = context
    const classes = ['loading-renderer']

    // 添加媒体类型特定的类
    if (data.mediaType === 'unknown') {
      classes.push('async-processing')
    } else {
      classes.push('normal-loading', `loading-${data.mediaType}`)
    }

    return classes
  }

  getCustomStyles(
    context: ContentRenderContext<MediaTypeOrUnknown>,
  ): Record<string, string | number> {
    return {
      borderStyle: 'dashed',
      animation: 'loading-pulse 2s infinite',
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 渲染异步处理内容（unknown类型）
   */
  private renderAsyncProcessing(context: ContentRenderContext<MediaTypeOrUnknown>): VNode {
    const { data } = context

    return h('div', { class: 'async-processing-content' }, [
      // 处理类型图标
      this.renderProcessingTypeIcon(data),
      // 处理状态文本
      this.renderProcessingStatus(data),
      // 进度圆环（如果有进度信息）
      this.renderProgressRing(context),
    ])
  }

  /**
   * 渲染普通加载内容
   */
  private renderNormalLoading(context: ContentRenderContext<MediaTypeOrUnknown>): VNode {
    const { data } = context

    return h('div', { class: 'normal-loading-content' }, [
      // 媒体类型图标
      this.renderMediaTypeIcon(data.mediaType),
      // 加载文本
      h('div', { class: 'loading-text' }, [
        h('div', { class: 'loading-title' }, this.getLoadingTitle(data)),
        h('div', { class: 'loading-subtitle' }, this.getLoadingSubtitle(data)),
      ]),
      // 加载动画
      this.renderLoadingSpinner(),
    ])
  }

  /**
   * 渲染处理类型图标
   */
  private renderProcessingTypeIcon(data: UnifiedTimelineItemData<MediaTypeOrUnknown>): VNode {
    // 根据配置名称或其他信息推断处理类型
    const processingType = this.inferProcessingType(data)

    return h(
      'div',
      {
        class: ['processing-type-icon', `type-${processingType}`],
      },
      this.getProcessingTypeEmoji(processingType),
    )
  }

  /**
   * 渲染处理状态文本
   */
  private renderProcessingStatus(data: UnifiedTimelineItemData<MediaTypeOrUnknown>): VNode {
    const statusText = this.getProcessingStatusText(data)

    return h('div', { class: 'processing-status' }, [
      h('div', { class: 'status-text' }, statusText.main),
      statusText.sub && h('div', { class: 'status-subtext' }, statusText.sub),
    ])
  }

  /**
   * 渲染进度圆环
   */
  private renderProgressRing(context: ContentRenderContext<MediaTypeOrUnknown>): VNode | null {
    const progressInfo = this.getProgressInfo(context.data)

    if (!progressInfo.hasProgress) {
      return null
    }

    const radius = 16
    const circumference = 2 * Math.PI * radius
    const strokeDasharray = circumference
    const strokeDashoffset = circumference - (progressInfo.percent / 100) * circumference

    return h('div', { class: 'progress-ring-container' }, [
      h(
        'svg',
        {
          class: 'progress-ring',
          width: 40,
          height: 40,
        },
        [
          // 背景圆环
          h('circle', {
            cx: 20,
            cy: 20,
            r: radius,
            fill: 'none',
            stroke: '#e6e6e6',
            'stroke-width': 3,
          }),
          // 进度圆环
          h('circle', {
            cx: 20,
            cy: 20,
            r: radius,
            fill: 'none',
            stroke: '#1890ff',
            'stroke-width': 3,
            'stroke-linecap': 'round',
            'stroke-dasharray': strokeDasharray,
            'stroke-dashoffset': strokeDashoffset,
            style: {
              transition: 'stroke-dashoffset 0.3s ease',
              transform: 'rotate(-90deg)',
              'transform-origin': '20px 20px',
            },
          }),
        ],
      ),
      // 中心文本
      h('div', { class: 'progress-ring-text' }, `${Math.round(progressInfo.percent)}%`),
    ])
  }

  /**
   * 渲染媒体类型图标
   */
  private renderMediaTypeIcon(mediaType: MediaTypeOrUnknown): VNode {
    const iconMap = {
      video: '🎬',
      image: '🖼️',
      audio: '🎵',
      text: '📝',
      unknown: '❓',
    }

    return h(
      'div',
      {
        class: ['media-type-icon', `icon-${mediaType}`],
      },
      iconMap[mediaType] || iconMap.unknown,
    )
  }

  /**
   * 渲染加载旋转器
   */
  private renderLoadingSpinner(): VNode {
    return h('div', { class: 'loading-spinner' }, [h('div', { class: 'spinner-ring' })])
  }

  // ==================== 辅助方法 ====================

  /**
   * 获取进度信息
   */
  private getProgressInfo(data: UnifiedTimelineItemData): {
    hasProgress: boolean
    percent: number
    speed?: string
  } {
    // 这里需要通过mediaItemId获取关联的媒体项目数据
    // 暂时返回模拟数据，实际实现需要从store或管理器中获取
    return {
      hasProgress: data.mediaType === 'unknown',
      percent: data.mediaType === 'unknown' ? 45 : 0,
      speed: undefined,
    }
  }

  /**
   * 推断处理类型
   */
  private inferProcessingType(data: UnifiedTimelineItemData<MediaTypeOrUnknown>): string {
    const name = getTimelineItemDisplayName(data)

    if (name.includes('http') || name.includes('download')) {
      return 'download'
    }

    return 'processing'
  }

  /**
   * 获取处理类型表情符号
   */
  private getProcessingTypeEmoji(type: string): string {
    const emojiMap: Record<string, string> = {
      download: '⬇️',
      processing: '⚙️',
      converting: '🔄',
      analyzing: '🔍',
    }

    return emojiMap[type] || '⚙️'
  }

  /**
   * 获取处理状态文本
   */
  private getProcessingStatusText(data: UnifiedTimelineItemData<MediaTypeOrUnknown>): {
    main: string
    sub?: string
  } {
    const name = getTimelineItemDisplayName(data)

    return {
      main: '处理中...',
      sub: name.length > 20 ? name.substring(0, 20) + '...' : name,
    }
  }

  /**
   * 获取加载标题
   */
  private getLoadingTitle(data: UnifiedTimelineItemData<MediaTypeOrUnknown>): string {
    const typeMap = {
      video: '视频加载中',
      image: '图片加载中',
      audio: '音频加载中',
      text: '文本加载中',
      unknown: '加载中',
    }

    return typeMap[data.mediaType] || typeMap.unknown
  }

  /**
   * 获取加载副标题
   */
  private getLoadingSubtitle(data: UnifiedTimelineItemData<MediaTypeOrUnknown>): string {
    const name = getTimelineItemDisplayName(data)
    return name.length > 15 ? name.substring(0, 15) + '...' : name
  }
}
