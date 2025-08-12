/**
 * 文本内容渲染器
 * 处理ready状态下文本类型的内容渲染
 *
 * 设计理念：
 * - 专门处理文本类型的显示
 * - 提供文本预览和字体信息
 * - 支持文本样式和动画效果预览
 * - 优化文本项目的视觉表现
 */

import { h } from 'vue'
import type { VNode } from 'vue'
import type { ContentRenderer, ContentRenderContext } from '@/unified/types/clipRenderer'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem/TimelineItemData'
import { getTimelineItemDisplayName } from '@/unified/utils/clipUtils'

/**
 * 文本内容渲染器
 */
export class TextContentRenderer implements ContentRenderer<'text'> {
  readonly type = 'text' as const

  renderContent(context: ContentRenderContext<'text'>): VNode {
    const { data, isSelected } = context

    return h(
      'div',
      {
        class: ['text-content', { selected: isSelected }],
        style: this.getTextContentStyles(),
      },
      [
        // 文本预览（与旧架构text-preview一致）
        this.renderTextPreview(data),
      ],
    )
  }

  getCustomClasses(context: ContentRenderContext<'text'>): string[] {
    const { data } = context
    const classes = ['text-renderer']

    // 添加文本样式相关的类
    const textConfig = this.getTextConfig(data)

    if (textConfig.isBold) {
      classes.push('has-bold')
    }

    if (textConfig.isItalic) {
      classes.push('has-italic')
    }

    if (textConfig.hasAnimation) {
      classes.push('has-animation')
    }

    return classes
  }

  getCustomStyles(context: ContentRenderContext<'text'>): Record<string, string | number> {
    // 不覆盖背景色，让UnifiedTimelineClip的统一样式生效
    // 但保留文本相关的样式设置
    const { data } = context
    const textConfig = this.getTextConfig(data)

    return {
      color: textConfig.color || 'white', // 改为白色以匹配旧架构
      fontFamily: textConfig.fontFamily || 'inherit',
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 获取文本内容样式（与旧架构text-content一致）
   */
  private getTextContentStyles(): Record<string, string> {
    return {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      padding: '4px 8px',
      overflow: 'hidden',
    }
  }

  /**
   * 渲染文本预览（与旧架构text-preview一致）
   */
  private renderTextPreview(data: UnifiedTimelineItemData<'text'>): VNode {
    const textConfig = this.getTextConfig(data)
    const previewText = this.getPreviewText(textConfig.content)

    return h(
      'div',
      {
        class: 'text-preview',
        style: this.getTextPreviewContainerStyles(),
      },
      [
        h(
          'div',
          {
            class: 'text-preview-content',
            style: this.getTextPreviewContentStyles(textConfig),
          },
          previewText,
        ),
      ],
    )
  }

  /**
   * 渲染文本覆盖层
   */
  private renderTextOverlay(data: UnifiedTimelineItemData<'text'>): VNode {
    return h('div', { class: 'text-overlay' }, [
      // 文本图标
      this.renderTextIcon(),
      // 时间显示
      this.renderTimeDisplay(data),
      // 文本标题
      this.renderTextTitle(data),
    ])
  }

  /**
   * 渲染文本图标
   */
  private renderTextIcon(): VNode {
    return h('div', { class: 'text-icon' }, '📝')
  }

  /**
   * 渲染时间显示
   */
  private renderTimeDisplay(data: UnifiedTimelineItemData<'text'>): VNode {
    const duration = this.getDuration(data)
    const timeText = this.formatTime(duration)

    return h('div', { class: 'time-display' }, [h('span', { class: 'time-text' }, timeText)])
  }

  /**
   * 渲染文本标题
   */
  private renderTextTitle(data: UnifiedTimelineItemData<'text'>): VNode {
    const name = getTimelineItemDisplayName(data)
    const displayName = name.length > 10 ? name.substring(0, 10) + '...' : name

    return h('div', { class: 'text-title' }, [h('span', { class: 'title-text' }, displayName)])
  }

  /**
   * 渲染样式指示器
   */
  private renderStyleIndicators(data: UnifiedTimelineItemData<'text'>): VNode {
    const textConfig = this.getTextConfig(data)
    const indicators = []

    // 字体信息
    if (textConfig.fontFamily && textConfig.fontFamily !== 'inherit') {
      indicators.push(
        h(
          'div',
          {
            key: 'font',
            class: 'style-indicator font-indicator',
          },
          this.getFontDisplayName(textConfig.fontFamily),
        ),
      )
    }

    // 字体大小
    if (textConfig.fontSize) {
      indicators.push(
        h(
          'div',
          {
            key: 'size',
            class: 'style-indicator size-indicator',
          },
          `${textConfig.fontSize}px`,
        ),
      )
    }

    // 样式标记
    const styleMarks = []
    if (textConfig.isBold) styleMarks.push('B')
    if (textConfig.isItalic) styleMarks.push('I')
    if (textConfig.isUnderline) styleMarks.push('U')

    if (styleMarks.length > 0) {
      indicators.push(
        h(
          'div',
          {
            key: 'styles',
            class: 'style-indicator style-marks',
          },
          styleMarks.join(''),
        ),
      )
    }

    // 动画指示器
    if (textConfig.hasAnimation) {
      indicators.push(
        h(
          'div',
          {
            key: 'animation',
            class: 'style-indicator animation-indicator',
          },
          '✨',
        ),
      )
    }

    return h('div', { class: 'style-indicators' }, indicators)
  }

  // ==================== 辅助方法 ====================

  /**
   * 获取文本配置
   */
  private getTextConfig(data: UnifiedTimelineItemData<'text'>): {
    content: string
    fontFamily?: string
    fontSize?: number
    color?: string
    isBold: boolean
    isItalic: boolean
    isUnderline: boolean
    hasAnimation: boolean
  } {
    // 从配置中获取文本相关设置
    const config = data.config as any

    return {
      content: config?.text || config?.content || '文本内容',
      fontFamily: config?.fontFamily,
      fontSize: config?.fontSize,
      color: config?.color,
      isBold: config?.isBold || false,
      isItalic: config?.isItalic || false,
      isUnderline: config?.isUnderline || false,
      hasAnimation: config?.animation || config?.hasAnimation || false,
    }
  }

  /**
   * 获取预览文本
   */
  private getPreviewText(content: string): string {
    if (!content || content.trim() === '') {
      return '文本内容'
    }

    // 限制预览文本长度
    const maxLength = 20
    if (content.length > maxLength) {
      return content.substring(0, maxLength) + '...'
    }

    return content
  }

  /**
   * 获取文本预览容器样式
   */
  private getTextPreviewContainerStyles(): Record<string, string> {
    return {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
    }
  }

  /**
   * 获取文本预览内容样式（与旧架构text-preview-content一致）
   */
  private getTextPreviewContentStyles(textConfig: any): Record<string, string> {
    const styles: Record<string, string> = {
      display: 'block',
      textAlign: 'center',
      lineHeight: '1.2',
      wordBreak: 'break-word',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      maxWidth: '100%',
      // 固定样式用于预览（与旧架构一致）
      fontSize: '11px',
      color: '#ffffff',
      fontWeight: 'normal',
      fontStyle: 'normal',
      fontFamily: 'Arial, sans-serif',
    }

    return styles
  }

  /**
   * 获取持续时间
   */
  private getDuration(data: UnifiedTimelineItemData<'text'>): number {
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
   * 获取字体显示名称
   */
  private getFontDisplayName(fontFamily: string): string {
    // 简化字体名称显示
    const fontMap: Record<string, string> = {
      Arial: 'Arial',
      Helvetica: 'Helvetica',
      'Times New Roman': 'Times',
      'Courier New': 'Courier',
      'Microsoft YaHei': '微软雅黑',
      SimSun: '宋体',
      SimHei: '黑体',
    }

    return fontMap[fontFamily] || fontFamily.split(',')[0] || 'Default'
  }
}
