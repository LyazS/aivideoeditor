/**
 * 时间轴项目状态显示工具函数
 * 基于媒体项目状态直接计算UI显示信息，替代原有的复杂上下文模板系统
 */

import type { UnifiedMediaItemData } from '../mediaitem'

/**
 * 状态显示信息接口
 */
export interface StatusDisplayInfo {
  text: string
  hasProgress: boolean
  percent: number
  speed?: string
  hasError: boolean
  errorMessage?: string
  recoverable?: boolean
}

/**
 * 时间轴状态显示工具类
 * 提供基于媒体项目状态的UI显示计算函数
 */
export class TimelineStatusDisplayUtils {
  /**
   * 获取完整的状态显示信息
   */
  static getStatusDisplayInfo(mediaData: UnifiedMediaItemData | null): StatusDisplayInfo {
    if (!mediaData) {
      return {
        text: '未知状态',
        hasProgress: false,
        percent: 0,
        hasError: false
      }
    }

    const progressInfo = this.getProgressInfo(mediaData)
    const errorInfo = this.getErrorInfo(mediaData)

    return {
      text: this.getStatusText(mediaData),
      hasProgress: progressInfo.hasProgress,
      percent: progressInfo.percent,
      speed: progressInfo.speed,
      hasError: errorInfo.hasError,
      errorMessage: errorInfo.message,
      recoverable: errorInfo.recoverable
    }
  }

  /**
   * 获取状态显示文本
   */
  static getStatusText(mediaData: UnifiedMediaItemData): string {
    switch (mediaData.mediaStatus) {
      case 'pending':
        return '等待处理'
      case 'asyncprocessing':
        if (mediaData.source?.status === 'acquiring') {
          const progress = mediaData.source.progress || 0
          // 只有远程文件源才有 downloadSpeed 属性
          const speed = (mediaData.source.type === 'remote' && 'downloadSpeed' in mediaData.source)
            ? mediaData.source.downloadSpeed
            : undefined
          return speed ? `获取中... ${progress}% (${speed})` : `获取中... ${progress}%`
        }
        return '解析中...'
      case 'webavdecoding':
        return '解析中...'
      case 'ready':
        return '就绪'
      case 'error':
        return '错误'
      case 'cancelled':
        return '已取消'
      case 'missing':
        return '文件缺失'
      default:
        return '处理中'
    }
  }

  /**
   * 获取进度信息
   */
  static getProgressInfo(mediaData: UnifiedMediaItemData): {
    hasProgress: boolean
    percent: number
    speed?: string
  } {
    switch (mediaData.mediaStatus) {
      case 'asyncprocessing':
        if (mediaData.source?.status === 'acquiring') {
          // 只有远程文件源才有 downloadSpeed 属性
          const speed = (mediaData.source.type === 'remote' && 'downloadSpeed' in mediaData.source)
            ? mediaData.source.downloadSpeed
            : undefined
          return {
            hasProgress: true,
            percent: mediaData.source.progress || 0,
            speed
          }
        }
        return { hasProgress: true, percent: 50 } // 解析阶段显示50%
      case 'webavdecoding':
        return { hasProgress: true, percent: 75 } // WebAV解析阶段显示75%
      default:
        return { hasProgress: false, percent: 0 }
    }
  }

  /**
   * 获取错误信息
   */
  static getErrorInfo(mediaData: UnifiedMediaItemData): { 
    hasError: boolean
    message?: string
    recoverable?: boolean 
  } {
    if (mediaData.mediaStatus !== 'error') {
      return { hasError: false }
    }
    
    return {
      hasError: true,
      message: mediaData.source?.errorMessage || '处理失败',
      recoverable: true // 大部分错误都可以重试
    }
  }

  /**
   * 检查是否有进度信息
   */
  static hasProgress(mediaData: UnifiedMediaItemData): boolean {
    return this.getProgressInfo(mediaData).hasProgress
  }

  /**
   * 检查是否有错误
   */
  static hasError(mediaData: UnifiedMediaItemData): boolean {
    return this.getErrorInfo(mediaData).hasError
  }

  /**
   * 获取进度百分比
   */
  static getProgressPercent(mediaData: UnifiedMediaItemData): number {
    return this.getProgressInfo(mediaData).percent
  }

  /**
   * 获取错误消息
   */
  static getErrorMessage(mediaData: UnifiedMediaItemData): string | null {
    const errorInfo = this.getErrorInfo(mediaData)
    return errorInfo.hasError ? (errorInfo.message || null) : null
  }

  /**
   * 检查错误是否可恢复
   */
  static isRecoverable(mediaData: UnifiedMediaItemData): boolean {
    const errorInfo = this.getErrorInfo(mediaData)
    return errorInfo.hasError ? (errorInfo.recoverable || false) : false
  }
}

/**
 * 便捷的计算属性工厂函数
 * 用于Vue组件中创建响应式的状态显示计算属性
 */
export const createStatusDisplayComputeds = (getMediaData: () => UnifiedMediaItemData | null) => {
  return {
    statusText: () => {
      const mediaData = getMediaData()
      return mediaData ? TimelineStatusDisplayUtils.getStatusText(mediaData) : '未知状态'
    },
    
    hasProgress: () => {
      const mediaData = getMediaData()
      return mediaData ? TimelineStatusDisplayUtils.hasProgress(mediaData) : false
    },
    
    progressPercent: () => {
      const mediaData = getMediaData()
      return mediaData ? TimelineStatusDisplayUtils.getProgressPercent(mediaData) : 0
    },
    
    progressText: () => {
      const mediaData = getMediaData()
      if (!mediaData) return ''
      
      const progressInfo = TimelineStatusDisplayUtils.getProgressInfo(mediaData)
      if (!progressInfo.hasProgress) return ''
      
      return progressInfo.speed 
        ? `${progressInfo.percent}% (${progressInfo.speed})`
        : `${progressInfo.percent}%`
    },
    
    hasError: () => {
      const mediaData = getMediaData()
      return mediaData ? TimelineStatusDisplayUtils.hasError(mediaData) : false
    },
    
    errorMessage: () => {
      const mediaData = getMediaData()
      return mediaData ? TimelineStatusDisplayUtils.getErrorMessage(mediaData) : null
    },
    
    canRetry: () => {
      const mediaData = getMediaData()
      return mediaData ? TimelineStatusDisplayUtils.isRecoverable(mediaData) : false
    }
  }
}
