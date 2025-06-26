import { useVideoStore } from '../stores/videoStore'

/**
 * 统一的对话框工具
 * 替换原生的 alert() 和 confirm() 使用统一的通知系统
 */
export function useDialogs() {
  const videoStore = useVideoStore()

  /**
   * 显示信息提示（替换 alert）
   * @param title 标题
   * @param message 消息内容
   * @param duration 显示时长（毫秒）
   */
  function showInfo(title: string, message?: string, duration?: number): void {
    videoStore.showInfo(title, message, duration)
  }

  /**
   * 显示错误提示（替换 alert 的错误场景）
   * @param title 标题
   * @param message 消息内容
   * @param duration 显示时长（毫秒）
   */
  function showError(title: string, message?: string, duration?: number): void {
    videoStore.showError(title, message, duration)
  }

  /**
   * 显示警告提示
   * @param title 标题
   * @param message 消息内容
   * @param duration 显示时长（毫秒）
   */
  function showWarning(title: string, message?: string, duration?: number): void {
    videoStore.showWarning(title, message, duration)
  }

  /**
   * 显示成功提示
   * @param title 标题
   * @param message 消息内容
   * @param duration 显示时长（毫秒）
   */
  function showSuccess(title: string, message?: string, duration?: number): void {
    videoStore.showSuccess(title, message, duration)
  }

  /**
   * 简单的确认对话框（暂时使用原生 confirm，后续可扩展为自定义组件）
   * @param title 标题
   * @param message 消息内容
   * @returns 用户是否确认
   */
  function confirm(title: string, message?: string): boolean {
    const fullMessage = message ? `${title}\n\n${message}` : title
    return window.confirm(fullMessage)
  }

  /**
   * 文件类型验证提示
   * @param acceptedTypes 接受的文件类型描述
   */
  function showFileTypeError(acceptedTypes: string = '视频或图片文件'): void {
    showError('文件类型错误', `请选择${acceptedTypes}`)
  }

  /**
   * 操作失败提示
   * @param operation 操作名称
   * @param error 错误信息
   */
  function showOperationError(operation: string, error?: string): void {
    const message = error ? `${operation}失败：${error}` : `${operation}失败`
    showError('操作失败', message)
  }

  /**
   * 删除确认对话框
   * @param itemName 要删除的项目名称
   * @param itemType 项目类型（如：素材、轨道等）
   * @param additionalInfo 额外信息
   * @returns 用户是否确认删除
   */
  function confirmDelete(
    itemName: string,
    itemType: string = '项目',
    additionalInfo?: string,
  ): boolean {
    let message = `确定要删除${itemType} "${itemName}" 吗？`
    if (additionalInfo) {
      message += `\n\n${additionalInfo}`
    }
    return confirm('确认删除', message)
  }

  /**
   * 轨道删除确认（特殊场景）
   * @param trackId 轨道ID
   * @param relatedItemsCount 相关项目数量
   * @returns 用户是否确认删除
   */
  function confirmTrackDelete(trackId: number, relatedItemsCount: number = 0): boolean {
    let message = `确定要删除轨道 ${trackId} 吗？`
    if (relatedItemsCount > 0) {
      message += `\n\n注意：这将同时删除轨道上的 ${relatedItemsCount} 个片段。`
    }
    return confirm('确认删除轨道', message)
  }

  /**
   * 素材删除确认（特殊场景）
   * @param mediaName 素材名称
   * @param relatedTimelineItemsCount 相关时间轴项目数量
   * @returns 用户是否确认删除
   */
  function confirmMediaDelete(mediaName: string, relatedTimelineItemsCount: number = 0): boolean {
    let message = `确定要删除素材 "${mediaName}" 吗？`
    if (relatedTimelineItemsCount > 0) {
      message += `\n\n注意：这将同时删除时间轴上的 ${relatedTimelineItemsCount} 个相关片段。`
    }
    return confirm('确认删除素材', message)
  }

  /**
   * 最少轨道数量限制提示
   */
  function showMinTrackWarning(): void {
    showWarning('无法删除', '至少需要保留一个轨道')
  }

  /**
   * 拖拽数据格式错误提示
   */
  function showDragDataError(): void {
    showError('拖拽失败', '拖拽数据格式错误')
  }

  /**
   * 无效拖拽提示
   */
  function showInvalidDragWarning(): void {
    showInfo('拖拽提示', '请先将视频或图片文件导入到素材库，然后从素材库拖拽到时间轴')
  }

  return {
    // 基础提示方法
    showInfo,
    showError,
    showWarning,
    showSuccess,
    confirm,

    // 专用提示方法
    showFileTypeError,
    showOperationError,
    showMinTrackWarning,
    showDragDataError,
    showInvalidDragWarning,

    // 确认对话框方法
    confirmDelete,
    confirmTrackDelete,
    confirmMediaDelete,
  }
}
