import type {
  SnapPoint,
  SnapResult,
  SnapCalculationOptions,
  SnapPointCollectionOptions,
  ClipBoundarySnapPoint,
  KeyframeSnapPoint,
  PlayheadSnapPoint,
  TimelineStartSnapPoint,
} from '../types/snap'
import { useVideoStore } from '../stores/videoStore'
import { isAsyncProcessingTimelineItem } from '../types'

/**
 * 吸附计算器类
 * 负责收集吸附点、计算距离、选择最佳吸附点
 */
export class SnapCalculator {
  private videoStore = useVideoStore()

  /**
   * 收集所有可用的吸附点
   */
  collectSnapPoints(options: SnapPointCollectionOptions = {}): SnapPoint[] {
    const snapPoints: SnapPoint[] = []

    // 收集片段边界点
    if (options.includeClipBoundaries !== false) {
      snapPoints.push(...this.collectClipBoundaryPoints(options.excludeClipIds || []))
    }

    // 收集关键帧点
    if (options.includeKeyframes !== false) {
      snapPoints.push(...this.collectKeyframePoints(options.excludeClipIds || []))
    }

    // 收集播放头位置
    if (options.includePlayhead !== false) {
      snapPoints.push(...this.collectPlayheadPoint())
    }

    // 收集时间轴起始位置
    if (options.includeTimelineStart !== false) {
      snapPoints.push(...this.collectTimelineStartPoint())
    }

    // 应用帧数范围过滤
    let filteredPoints = snapPoints
    if (options.frameRange) {
      filteredPoints = snapPoints.filter(
        (point) =>
          point.frame >= options.frameRange!.start && point.frame <= options.frameRange!.end,
      )
    }

    // 去重并排序
    const uniquePoints = this.deduplicateSnapPoints(filteredPoints)
    return uniquePoints.sort((a, b) => a.frame - b.frame)
  }

  /**
   * 收集片段边界点
   */
  private collectClipBoundaryPoints(excludeClipIds: string[]): ClipBoundarySnapPoint[] {
    const points: ClipBoundarySnapPoint[] = []

    for (const item of this.videoStore.timelineItems) {
      // 跳过排除的片段
      if (excludeClipIds.includes(item.id)) {
        continue
      }

      // 获取媒体项目名称
      const mediaItem = this.videoStore.getLocalMediaItem(item.mediaItemId)
      const clipName = mediaItem?.name || '未命名片段'

      // 片段开始位置
      points.push({
        type: 'clip-start',
        frame: item.timeRange.timelineStartTime,
        clipId: item.id,
        clipName,
        priority: 1,
      })

      // 片段结束位置
      points.push({
        type: 'clip-end',
        frame: item.timeRange.timelineEndTime,
        clipId: item.id,
        clipName,
        priority: 1,
      })
    }

    return points
  }

  /**
   * 收集关键帧点
   */
  private collectKeyframePoints(excludeClipIds: string[]): KeyframeSnapPoint[] {
    const points: KeyframeSnapPoint[] = []

    for (const item of this.videoStore.timelineItems) {
      // 跳过排除的片段
      if (excludeClipIds.includes(item.id)) {
        continue
      }
      if (isAsyncProcessingTimelineItem(item)) continue

      // 检查是否有动画和关键帧
      if (item.animation && item.animation.keyframes) {
        for (const keyframe of item.animation.keyframes) {
          // 将关键帧的相对时间转换为时间轴绝对时间
          const absoluteFrame = item.timeRange.timelineStartTime + keyframe.framePosition

          points.push({
            type: 'keyframe',
            frame: absoluteFrame,
            clipId: item.id,
            keyframeId: `${item.id}-${keyframe.framePosition}`,
            priority: 2,
          })
        }
      }
    }

    return points
  }

  /**
   * 收集播放头位置
   */
  private collectPlayheadPoint(): PlayheadSnapPoint[] {
    const currentFrame = this.videoStore.currentFrame

    return [
      {
        type: 'playhead',
        frame: currentFrame,
        priority: 1,
      },
    ]
  }

  /**
   * 收集时间轴起始位置
   */
  private collectTimelineStartPoint(): TimelineStartSnapPoint[] {
    return [
      {
        type: 'timeline-start',
        frame: 0,
        priority: 3,
      },
    ]
  }

  /**
   * 去重吸附点（相同帧数的点只保留优先级最高的）
   */
  private deduplicateSnapPoints(points: SnapPoint[]): SnapPoint[] {
    const frameMap = new Map<number, SnapPoint>()

    for (const point of points) {
      const existing = frameMap.get(point.frame)
      if (!existing || point.priority < existing.priority) {
        frameMap.set(point.frame, point)
      }
    }

    return Array.from(frameMap.values())
  }

  /**
   * 计算吸附结果
   */
  calculateSnap(targetFrame: number, snapPoints: SnapPoint[], thresholdFrames: number): SnapResult {
    if (snapPoints.length === 0) {
      return {
        snapped: false,
        frame: targetFrame,
      }
    }

    let closestPoint: SnapPoint | undefined
    let minDistance = Infinity

    // 找到最近的吸附点
    for (const point of snapPoints) {
      const distance = Math.abs(targetFrame - point.frame)
      if (distance <= thresholdFrames && distance < minDistance) {
        minDistance = distance
        closestPoint = point
      }
    }

    if (closestPoint) {
      return {
        snapped: true,
        frame: closestPoint.frame,
        snapPoint: closestPoint,
        distance: minDistance,
      }
    }

    return {
      snapped: false,
      frame: targetFrame,
    }
  }

  /**
   * 将像素阈值转换为帧数阈值
   */
  pixelThresholdToFrames(pixelThreshold: number, timelineWidth: number): number {
    const frameAtThreshold = this.videoStore.pixelToFrame(pixelThreshold, timelineWidth)
    const frameAtZero = this.videoStore.pixelToFrame(0, timelineWidth)
    return Math.abs(frameAtThreshold - frameAtZero)
  }
}
