import { OffscreenSprite } from '@webav/av-cliper'
import type { UnifiedTimeRange } from '@/unified/types/timeRange'
import { framesToMicroseconds } from '@/unified/utils/timeUtils'

/**
 * 基础的OffscreenSprite类，继承自WebAV的OffscreenSprite
 * 作为所有OffscreenSprite的公共父类，专注于视频合成功能
 * 移除了事件监听功能，简化了接口
 */
export abstract class BaseOffscreenSprite extends OffscreenSprite {
  /**
   * 时间范围信息（帧数版本）
   */
  #timeRange: UnifiedTimeRange = {
    clipStartTime: 0, // 帧数
    clipEndTime: 0, // 帧数
    timelineStartTime: 0, // 帧数
    timelineEndTime: 0, // 帧数
  }

  /**
   * 构造函数
   * @param clip Clip实例
   */
  constructor(clip: any) {
    // 调用父类构造函数
    super(clip)
  }

  // ==================== 时间轴接口 ====================

  /**
   * 设置时间范围
   * @param timeRange 新的时间范围
   */
  public setTimeRange(timeRange: Partial<UnifiedTimeRange>): void {
    // 更新时间范围属性
    if (timeRange.clipStartTime !== undefined) {
      this.#timeRange.clipStartTime = timeRange.clipStartTime
    }
    if (timeRange.clipEndTime !== undefined) {
      this.#timeRange.clipEndTime = timeRange.clipEndTime
    }
    if (timeRange.timelineStartTime !== undefined) {
      this.#timeRange.timelineStartTime = timeRange.timelineStartTime
    }
    if (timeRange.timelineEndTime !== undefined) {
      this.#timeRange.timelineEndTime = timeRange.timelineEndTime
    }

    // 更新OffscreenSprite的时间
    this.updateOffscreenSpriteTime()
  }

  // ==================== 受保护的方法 ====================

  /**
   * 获取当前时间范围，供子类使用
   */
  protected getTimeRange(): UnifiedTimeRange {
    return { ...this.#timeRange }
  }

  // ==================== 抽象方法 ====================

  /**
   * 更新 OffscreenSprite 的 time 属性
   * 由子类实现各自的定制化逻辑
   */
  protected abstract updateOffscreenSpriteTime(): void
}