/**
 * 时间轴项目状态显示工具函数
 * 基于媒体项目状态直接计算显示信息，替代原有的复杂上下文模板系统
 */

// ==================== 向后兼容的工具类 ====================

/**
 * 时间轴上下文工具类（最小化向后兼容）
 *
 * 仅保留必要的类型检查方法，新代码请使用 TimelineStatusDisplayUtils
 */
export class TimelineContextUtils {
  /**
   * 检查上下文是否为就绪状态
   */
  static isReady(context: any): boolean {
    return context?.stage === 'ready'
  }

  /**
   * 检查上下文是否为错误状态
   */
  static isError(context: any): boolean {
    return context?.stage === 'error'
  }

  /**
   * 检查上下文是否有进度信息
   */
  static hasProgress(context: any): boolean {
    return context?.progress && typeof context.progress.percent === 'number'
  }

  /**
   * 检查上下文是否为下载状态
   */
  static isDownload(context: any): boolean {
    return context?.stage === 'downloading' || context?.stage === 'acquiring'
  }

  /**
   * 检查上下文是否为解析状态
   */
  static isParse(context: any): boolean {
    return context?.stage === 'parsing' || context?.stage === 'processing'
  }

  /**
   * 检查上下文是否有错误
   */
  static hasError(context: any): boolean {
    return context?.stage === 'error' || context?.error
  }
}

// ==================== 重新导出新的状态显示工具 ====================

/**
 * 重新导出独立的状态显示工具类
 */
export {
  TimelineStatusDisplayUtils,
  createStatusDisplayComputeds,
  type StatusDisplayInfo
} from './TimelineStatusDisplayUtils'
