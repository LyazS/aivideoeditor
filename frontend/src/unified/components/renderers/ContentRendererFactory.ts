/**
 * 内容渲染器工厂
 * 基于状态优先的渲染策略选择合适的渲染器
 *
 * 设计理念：
 * - 状态优先：优先基于状态选择渲染器，确保状态显示的一致性
 * - 媒体类型次之：ready状态下基于媒体类型选择渲染器
 * - 可扩展：支持注册自定义渲染器
 * - 兜底机制：提供默认渲染器确保系统稳定性
 */

import { h } from 'vue'
import type { VNode } from 'vue'
import type {
  ContentRenderer,
  ContentRenderContext,
} from '@/unified/types/clipRenderer'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem/TimelineItemData'
import type { MediaType } from '@/unified/mediaitem/types'
import type { TimelineItemStatus } from '@/unified/timelineitem/TimelineItemData'
import { getTimelineItemDisplayName } from '@/unified/utils/clipUtils'

// 导入具体的渲染器实现
import { LoadingContentRenderer, ErrorContentRenderer } from '@/unified/components/renderers/status'
import { VideoContentRenderer, AudioContentRenderer, TextContentRenderer } from '@/unified/components/renderers/mediatype'

// ==================== 默认渲染器实现 ====================

/**
 * 默认渲染器 - 用作兜底
 */
class DefaultContentRenderer implements ContentRenderer<MediaType> {
  readonly type = 'default' as const

  renderContent(context: ContentRenderContext<MediaType>): VNode {
    const { data, isSelected } = context

    return h(
      'div',
      {
        class: ['default-renderer-content', { selected: isSelected }],
      },
      [
        h('div', { class: 'media-type-indicator' }, data.mediaType),
        h('div', { class: 'status-indicator' }, data.timelineStatus),
        h('div', { class: 'item-name' }, getTimelineItemDisplayName(data)),
      ],
    )
  }

  getCustomClasses(context: ContentRenderContext<MediaType>): string[] {
    return ['default-renderer']
  }

}

// ==================== 渲染器工厂类 ====================

/**
 * 内容渲染器工厂类
 */
export class ContentRendererFactory {
  // 状态优先渲染器映射
  private static statusRenderers = new Map<TimelineItemStatus, ContentRenderer>()

  // 媒体类型渲染器映射（仅用于ready状态）
  private static mediaTypeRenderers = new Map<MediaType, ContentRenderer>()

  // 默认渲染器
  private static defaultRenderer = new DefaultContentRenderer()

  // 静态初始化标志
  private static initialized = false

  // ==================== 核心方法 ====================

  /**
   * 获取指定数据的内容渲染器
   * 优先基于状态选择，然后基于媒体类型选择
   */
  static getRenderer<T extends MediaType>(
    data: UnifiedTimelineItemData<T>,
  ): ContentRenderer<T> {
    // 确保渲染器已初始化
    this.ensureInitialized()

    // 第一优先级：基于状态选择渲染器
    if (data.timelineStatus !== 'ready') {
      const statusRenderer = this.statusRenderers.get(data.timelineStatus)
      if (statusRenderer) {
        return statusRenderer as ContentRenderer<T>
      }
    }

    // 第二优先级：ready状态下基于媒体类型选择渲染器
    if (data.timelineStatus === 'ready') {
      const mediaTypeRenderer = this.mediaTypeRenderers.get(data.mediaType)
      if (mediaTypeRenderer) {
        return mediaTypeRenderer as ContentRenderer<T>
      }
    }

    // 兜底：返回默认渲染器
    return this.defaultRenderer as ContentRenderer<T>
  }

  // ==================== 注册方法 ====================

  /**
   * 注册状态渲染器
   * @param status 状态类型
   * @param renderer 渲染器实例
   */
  static registerStatusRenderer(status: TimelineItemStatus, renderer: ContentRenderer): void {
    this.statusRenderers.set(status, renderer)
  }

  /**
   * 注册媒体类型渲染器
   * @param type 媒体类型
   * @param renderer 渲染器实例
   */
  static registerMediaTypeRenderer<T extends MediaType>(
    type: T,
    renderer: ContentRenderer<T>,
  ): void {
    this.mediaTypeRenderers.set(type, renderer)
  }

  // ==================== 查询方法 ====================

  /**
   * 获取所有已注册的状态渲染器
   */
  static getStatusRenderers(): Map<TimelineItemStatus, ContentRenderer> {
    return new Map(this.statusRenderers)
  }

  /**
   * 获取所有已注册的媒体类型渲染器
   */
  static getMediaTypeRenderers(): Map<MediaType, ContentRenderer> {
    return new Map(this.mediaTypeRenderers)
  }

  /**
   * 检查是否有指定状态的渲染器
   */
  static hasStatusRenderer(status: TimelineItemStatus): boolean {
    return this.statusRenderers.has(status)
  }

  /**
   * 检查是否有指定媒体类型的渲染器
   */
  static hasMediaTypeRenderer(type: MediaType): boolean {
    return this.mediaTypeRenderers.has(type)
  }

  // ==================== 管理方法 ====================

  /**
   * 移除状态渲染器
   */
  static removeStatusRenderer(status: TimelineItemStatus): boolean {
    return this.statusRenderers.delete(status)
  }

  /**
   * 移除媒体类型渲染器
   */
  static removeMediaTypeRenderer(type: MediaType): boolean {
    return this.mediaTypeRenderers.delete(type)
  }

  /**
   * 清空所有渲染器
   */
  static clearAllRenderers(): void {
    this.statusRenderers.clear()
    this.mediaTypeRenderers.clear()
  }

  /**
   * 重置为默认状态
   */
  static reset(): void {
    this.clearAllRenderers()
    // 可以在这里注册一些默认的渲染器
  }

  // ==================== 调试方法 ====================

  /**
   * 获取渲染器选择的调试信息
   */
  static getDebugInfo<T extends MediaType>(
    data: UnifiedTimelineItemData<T>,
  ): {
    selectedRenderer: string
    availableStatusRenderers: string[]
    availableMediaTypeRenderers: string[]
    selectionReason: string
  } {
    this.ensureInitialized()

    let selectedRenderer = 'default'
    let selectionReason = 'No specific renderer found'

    // 检查状态渲染器
    if (data.timelineStatus !== 'ready' && this.statusRenderers.has(data.timelineStatus)) {
      selectedRenderer = `status-${data.timelineStatus}`
      selectionReason = `Status renderer for '${data.timelineStatus}'`
    }
    // 检查媒体类型渲染器
    else if (data.timelineStatus === 'ready' && this.mediaTypeRenderers.has(data.mediaType)) {
      selectedRenderer = `mediatype-${data.mediaType}`
      selectionReason = `Media type renderer for '${data.mediaType}'`
    }

    return {
      selectedRenderer,
      availableStatusRenderers: Array.from(this.statusRenderers.keys()),
      availableMediaTypeRenderers: Array.from(this.mediaTypeRenderers.keys()),
      selectionReason,
    }
  }

  // ==================== 初始化方法 ====================

  /**
   * 确保渲染器已初始化
   */
  private static ensureInitialized(): void {
    if (!this.initialized) {
      this.initializeDefaultRenderers()
      this.initialized = true
    }
  }

  /**
   * 初始化默认渲染器
   */
  private static initializeDefaultRenderers(): void {
    // 注册状态渲染器
    this.statusRenderers.set('loading', new LoadingContentRenderer())
    this.statusRenderers.set('error', new ErrorContentRenderer())

    // 注册媒体类型渲染器
    this.mediaTypeRenderers.set('video', new VideoContentRenderer())
    this.mediaTypeRenderers.set('image', new VideoContentRenderer()) // 视频和图片使用同一个渲染器
    this.mediaTypeRenderers.set('audio', new AudioContentRenderer())
    this.mediaTypeRenderers.set('text', new TextContentRenderer())

    console.log('🎨 ContentRendererFactory: 默认渲染器已初始化')
  }
}
