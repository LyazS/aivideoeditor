/**
 * 验证工具类
 * 提供操作验证相关的工具函数
 */
export class ValidationUtils {
  /**
   * 验证时间轴项目ID是否存在
   */
  static validateTimelineItemExists(itemId: string, getItem: (id: string) => any): boolean {
    return !!getItem(itemId)
  }

  /**
   * 验证轨道ID是否存在
   */
  static validateTrackExists(trackId: number, getTrack: (id: number) => any): boolean {
    return !!getTrack(trackId)
  }

  /**
   * 验证媒体项目是否存在且已准备就绪
   */
  static validateMediaItemReady(mediaItemId: string, getMediaItem: (id: string) => any): boolean {
    const mediaItem = getMediaItem(mediaItemId)
    return !!(mediaItem && mediaItem.isReady)
  }

  /**
   * 验证时间范围是否有效
   */
  static validateTimeRange(timeRange: { timelineStartTime: number; timelineEndTime: number }): boolean {
    return timeRange.timelineStartTime >= 0 && 
           timeRange.timelineEndTime > timeRange.timelineStartTime
  }

  /**
   * 验证变换属性是否有效
   */
  static validateTransform(transform: {
    position?: { x: number; y: number }
    size?: { width: number; height: number }
    rotation?: number
    opacity?: number
    zIndex?: number
  }): boolean {
    if (transform.size && (transform.size.width <= 0 || transform.size.height <= 0)) {
      return false
    }
    if (transform.opacity !== undefined && (transform.opacity < 0 || transform.opacity > 1)) {
      return false
    }
    return true
  }

  /**
   * 验证音频属性是否有效
   */
  static validateAudioProperties(audio: {
    volume?: number
    isMuted?: boolean
  }): boolean {
    if (audio.volume !== undefined && (audio.volume < 0 || audio.volume > 1)) {
      return false
    }
    return true
  }
}
