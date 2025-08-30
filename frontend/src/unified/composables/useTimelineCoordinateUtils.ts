import { ref, type Ref } from 'vue'
import { useUnifiedStore } from '@/unified/unifiedStore'

/**
 * 时间轴坐标转换工具模块
 * 提供时间轴坐标转换相关的功能，包括时间轴宽度更新和位置计算
 */
export function useTimelineCoordinateUtils(timelineBodyParam: any, timelineWidthParam: any, unifiedStoreParam: any) {
  const unifiedStore = unifiedStoreParam
  const timelineBody = timelineBodyParam
  const timelineWidth = timelineWidthParam

  /**
   * 更新时间轴宽度
   * 计算轨道内容区域的宽度（总宽度减去轨道控制区域的150px）
   */
  function updateTimelineWidth() {
    if (timelineBody.value) {
      // 计算轨道内容区域的宽度（总宽度减去轨道控制区域的150px）
      timelineWidth.value = timelineBody.value.clientWidth - 150
    }
  }

  /**
   * 从右键菜单上下文获取时间位置
   * 将右键点击的屏幕坐标转换为时间轴上的帧数位置
   * @returns 时间位置（帧数）
   */
  function getTimePositionFromContextMenu(contextMenuOptions: { x: number }): number {
    // 获取右键点击的位置
    const clickX = contextMenuOptions.x

    // 计算相对于时间轴内容区域的位置
    const timelineBodyRect = timelineBody.value?.getBoundingClientRect()
    if (!timelineBodyRect) {
      console.warn('⚠️ 无法获取时间轴主体边界，使用默认位置')
      return 0
    }

    // 减去轨道控制区域的宽度（150px）
    const relativeX = clickX - timelineBodyRect.left - 150

    // 转换为帧数
    const timeFrames = unifiedStore.pixelToFrame(relativeX, timelineWidth.value)

    // 确保时间位置不为负数
    return Math.max(0, Math.round(timeFrames))
  }

  return {
    // 状态
    timelineBody,
    timelineWidth,
    
    // 方法
    updateTimelineWidth,
    getTimePositionFromContextMenu,
  }
}