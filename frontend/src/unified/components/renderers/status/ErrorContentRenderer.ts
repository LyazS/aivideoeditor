/**
 * 错误状态内容渲染器
 * 处理所有error状态的内容渲染
 *
 * 设计理念：
 * - 统一处理所有错误状态的显示
 * - 提供清晰的错误信息和重试机制
 * - 支持不同类型的错误显示
 * - 提供用户友好的错误反馈
 */

import { h } from 'vue'
import type { VNode } from 'vue'
import type { ContentRenderer, ContentRenderContext } from '../../../types/clipRenderer'
import type { UnifiedTimelineItemData } from '../../../timelineitem/TimelineItemData'
import type { MediaTypeOrUnknown } from '../../../mediaitem/types'
import { getTimelineItemDisplayName } from '../../../utils/clipUtils'

/**
 * 错误状态内容渲染器
 */
export class ErrorContentRenderer implements ContentRenderer<MediaTypeOrUnknown> {
  readonly type = 'error' as const

  renderContent(context: ContentRenderContext<MediaTypeOrUnknown>): VNode {
    const { data, isSelected } = context

    return h(
      'div',
      {
        class: ['error-content', { selected: isSelected }],
      },
      [
        // 错误图标
        this.renderErrorIcon(data),
        // 错误信息
        this.renderErrorMessage(data),
        // 重试按钮（如果支持）
        this.renderRetryButton(context),
      ],
    )
  }

  renderStatusIndicator(context: ContentRenderContext<MediaTypeOrUnknown>): VNode {
    return h(
      'div',
      {
        class: 'error-status-indicator',
      },
      [h('div', { class: 'error-icon-small' }, '⚠️')],
    )
  }

  getCustomClasses(context: ContentRenderContext<MediaTypeOrUnknown>): string[] {
    const { data } = context
    const classes = ['error-renderer', 'error-state']

    // 添加错误类型特定的类
    const errorType = this.getErrorType(data)
    classes.push(`error-${errorType}`)

    return classes
  }

  getCustomStyles(
    context: ContentRenderContext<MediaTypeOrUnknown>,
  ): Record<string, string | number> {
    return {
      borderColor: '#ff4d4f',
      backgroundColor: 'rgba(255, 77, 79, 0.1)',
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 渲染错误图标
   */
  private renderErrorIcon(data: UnifiedTimelineItemData<MediaTypeOrUnknown>): VNode {
    const errorType = this.getErrorType(data)
    const iconMap = {
      network: '🌐',
      file: '📁',
      format: '🔧',
      permission: '🔒',
      timeout: '⏰',
      unknown: '❌',
    }

    return h(
      'div',
      {
        class: ['error-icon-large', `error-${errorType}`],
      },
      [
        h(
          'div',
          { class: 'error-emoji' },
          iconMap[errorType as keyof typeof iconMap] || iconMap.unknown,
        ),
        h('div', { class: 'error-type-text' }, this.getErrorTypeText(errorType)),
      ],
    )
  }

  /**
   * 渲染错误信息
   */
  private renderErrorMessage(data: UnifiedTimelineItemData<MediaTypeOrUnknown>): VNode {
    const errorInfo = this.getErrorInfo(data)

    return h('div', { class: 'error-message-container' }, [
      // 主要错误信息
      h('div', { class: 'error-message-main' }, errorInfo.message),
      // 详细错误信息（如果有）
      errorInfo.details && h('div', { class: 'error-message-details' }, errorInfo.details),
      // 项目名称
      h('div', { class: 'error-item-name' }, getTimelineItemDisplayName(data)),
    ])
  }

  /**
   * 渲染重试按钮
   */
  private renderRetryButton(context: ContentRenderContext<MediaTypeOrUnknown>): VNode | null {
    const { data } = context
    const errorInfo = this.getErrorInfo(data)

    // 如果错误不可恢复，不显示重试按钮
    if (!errorInfo.recoverable) {
      return null
    }

    return h('div', { class: 'error-actions' }, [
      h(
        'button',
        {
          class: 'retry-button',
          onClick: (event: MouseEvent) => {
            event.stopPropagation()
            this.handleRetry(data)
          },
        },
        [h('span', { class: 'retry-icon' }, '🔄'), h('span', { class: 'retry-text' }, '重试')],
      ),
      // 删除按钮
      h(
        'button',
        {
          class: 'remove-button',
          onClick: (event: MouseEvent) => {
            event.stopPropagation()
            this.handleRemove(data)
          },
        },
        [h('span', { class: 'remove-icon' }, '🗑️'), h('span', { class: 'remove-text' }, '删除')],
      ),
    ])
  }

  // ==================== 辅助方法 ====================

  /**
   * 获取错误类型
   */
  private getErrorType(data: UnifiedTimelineItemData<MediaTypeOrUnknown>): string {
    // 这里需要通过mediaItemId获取关联的媒体项目数据来判断错误类型
    // 暂时根据配置名称推断错误类型
    const name = getTimelineItemDisplayName(data)

    if (name.includes('http') || name.includes('网络')) {
      return 'network'
    }

    if (name.includes('文件') || name.includes('找不到')) {
      return 'file'
    }

    if (name.includes('格式') || name.includes('不支持')) {
      return 'format'
    }

    if (name.includes('权限') || name.includes('访问')) {
      return 'permission'
    }

    if (name.includes('超时') || name.includes('timeout')) {
      return 'timeout'
    }

    return 'unknown'
  }

  /**
   * 获取错误类型文本
   */
  private getErrorTypeText(errorType: string): string {
    const textMap: Record<string, string> = {
      network: '网络错误',
      file: '文件错误',
      format: '格式错误',
      permission: '权限错误',
      timeout: '超时错误',
      unknown: '未知错误',
    }

    return textMap[errorType] || textMap.unknown
  }

  /**
   * 获取错误信息
   */
  private getErrorInfo(data: UnifiedTimelineItemData<MediaTypeOrUnknown>): {
    message: string
    details?: string
    recoverable: boolean
  } {
    // 这里需要通过mediaItemId获取关联的媒体项目数据来获取具体错误信息
    // 暂时返回通用错误信息
    const errorType = this.getErrorType(data)

    const messageMap: Record<string, { message: string; details?: string; recoverable: boolean }> =
      {
        network: {
          message: '网络连接失败',
          details: '请检查网络连接后重试',
          recoverable: true,
        },
        file: {
          message: '文件加载失败',
          details: '文件可能已被移动或删除',
          recoverable: true,
        },
        format: {
          message: '文件格式不支持',
          details: '请使用支持的文件格式',
          recoverable: false,
        },
        permission: {
          message: '访问权限不足',
          details: '请检查文件访问权限',
          recoverable: true,
        },
        timeout: {
          message: '加载超时',
          details: '文件过大或网络较慢',
          recoverable: true,
        },
        unknown: {
          message: '加载失败',
          details: '发生未知错误',
          recoverable: true,
        },
      }

    return messageMap[errorType] || messageMap.unknown
  }

  /**
   * 处理重试操作
   */
  private handleRetry(data: UnifiedTimelineItemData<MediaTypeOrUnknown>): void {
    console.log(`🔄 重试加载项目: ${data.id}`)

    // 这里需要调用相应的重试逻辑
    // 可能需要：
    // 1. 重置时间轴项目状态为loading
    // 2. 重新启动媒体项目的处理流程
    // 3. 通知相关管理器重新处理

    // 暂时只是日志输出，实际实现需要集成到管理器中
    console.log(`TODO: 实现重试逻辑 for ${data.mediaItemId}`)
  }

  /**
   * 处理删除操作
   */
  private handleRemove(data: UnifiedTimelineItemData<MediaTypeOrUnknown>): void {
    console.log(`🗑️ 删除错误项目: ${data.id}`)

    // 这里需要调用相应的删除逻辑
    // 可能需要：
    // 1. 从时间轴中移除项目
    // 2. 清理相关的媒体项目（如果没有其他引用）
    // 3. 通知UI更新

    // 暂时只是日志输出，实际实现需要集成到管理器中
    console.log(`TODO: 实现删除逻辑 for ${data.id}`)
  }
}
