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
import type { ContentRenderer, ContentRenderContext } from '@/unified/types/clipRenderer'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem/TimelineItemData'
import type { MediaType } from '@/unified/mediaitem/types'
import { getTimelineItemDisplayName } from '@/unified/utils/clipUtils'
import { useUnifiedStore } from '@/unified/unifiedStore'
import type { RemoteFileSourceData } from '@/unified/sources/RemoteFileSource'

/**
 * 加载状态内容渲染器
 */
export class LoadingContentRenderer implements ContentRenderer<MediaType> {
  readonly type = 'loading' as const
  private unifiedStore = useUnifiedStore()

  renderContent(context: ContentRenderContext<MediaType>): VNode {
    const { data, isSelected } = context

    return h(
      'div',
      {
        class: ['clip-loading-content', { selected: isSelected }],
      },
      [
        // 只渲染普通加载内容，因为不再支持 unknown 类型
        this.renderNormalLoading(context),
      ],
    )
  }

  renderProgressBar(context: ContentRenderContext<MediaType>): VNode | null {
    // 优先从上下文中获取进度信息（如果由UnifiedTimelineClip.vue提供）
    const progressInfo = context.progressInfo || this.getProgressInfo(context.data)

    if (!progressInfo.hasProgress) {
      return null
    }

    return h('div', { class: 'clip-loading-progress-bar' }, [
      h('div', {
        class: 'clip-progress-fill',
        style: {
          width: `${progressInfo.percent}%`,
          transition: 'width 0.3s ease',
        },
      }),
    ])
  }

  getCustomClasses(context: ContentRenderContext<MediaType>): string[] {
    const { data } = context
    const classes = ['clip-loading-renderer']

    // 添加媒体类型特定的类
    classes.push('clip-normal-loading', `clip-loading-${data.mediaType}`)

    return classes
  }

  getCustomStyles(context: ContentRenderContext<MediaType>): Record<string, string | number> {
    return {
      borderStyle: 'dashed',
      animation: 'clip-loading-pulse 2s infinite',
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 渲染普通加载内容
   */
  private renderNormalLoading(context: ContentRenderContext<MediaType>): VNode {
    const { data } = context

    return h('div', { class: 'clip-normal-loading-content' }, [
      // 统一的加载图标
      // this.renderLoadingSpinner(),
      // 加载文本
      h('div', { class: 'clip-loading-text' }, [
        h('div', { class: 'clip-loading-title' }, '加载中'),
        h('div', { class: 'clip-loading-subtitle' }, this.getLoadingSubtitle(data)),
      ]),
    ])
  }

  /**
   * 渲染加载旋转器
   */
  private renderLoadingSpinner(): VNode {
    return h('div', { class: 'clip-loading-spinner' }, [h('div', { class: 'clip-spinner-ring' })])
  }

  // ==================== 辅助方法 ====================

  /**
   * 获取进度信息 - 从媒体项目获取实际进度数据
   */
  private getProgressInfo(data: UnifiedTimelineItemData<MediaType>): {
    hasProgress: boolean
    percent: number
    speed?: string
  } {
    // 通过mediaItemId获取关联的媒体项目数据
    const mediaItem = this.unifiedStore.getMediaItem(data.mediaItemId)
    if (!mediaItem) {
      return { hasProgress: false, percent: 0 }
    }

    const source = mediaItem.source
    if (!source) {
      return { hasProgress: false, percent: 0 }
    }

    // 根据数据源类型获取进度信息
    if (source.type === 'remote') {
      // 远程文件源：使用下载字节数计算进度
      const remoteSource = source as RemoteFileSourceData
      if (remoteSource.totalBytes === 0) {
        return { hasProgress: false, percent: 0 }
      }
      const percent = (remoteSource.downloadedBytes / remoteSource.totalBytes) * 100
      return {
        hasProgress: true,
        percent,
        speed: remoteSource.downloadSpeed,
      }
    } else {
      // 其他类型：使用基础进度值
      return {
        hasProgress: source.progress > 0,
        percent: source.progress,
      }
    }
  }

  /**
   * 获取加载副标题
   */
  private getLoadingSubtitle(data: UnifiedTimelineItemData<MediaType>): string {
    const name = getTimelineItemDisplayName(data)
    return name.length > 15 ? name.substring(0, 15) + '...' : name
  }
}
