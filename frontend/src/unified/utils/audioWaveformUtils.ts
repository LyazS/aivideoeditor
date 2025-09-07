/**
 * 音频波形渲染工具函数
 * 基于直接PCM数据获取的简化音频波形渲染方案
 */

import { microsecondsToFrames } from './timeUtils'
import type { UnifiedTimelineItemData } from '../timelineitem'
import { useUnifiedStore } from '@/unified/unifiedStore'
import { DEFAULT_TRACK_HEIGHTS, DEFAULT_TRACK_PADDING } from '@/unified/constants/TrackConstants'

function preparePCMData(
  fullPcmData: Float32Array,
  timelineItem: UnifiedTimelineItemData,
  clipWholeDurationFrames: number, // 音频总时长(帧数)
  startFrame: number, // 帧数
  endFrame: number, // 帧数
): {
  pcmData: Float32Array
  startPercent: number
  endPercent: number
} {
  if (!fullPcmData || fullPcmData.length === 0) {
    return {
      pcmData: new Float32Array(),
      startPercent: 0,
      endPercent: 0,
    }
  }
  // 时间轴长度
  const tlDurationFrames =
    timelineItem.timeRange.timelineEndTime - timelineItem.timeRange.timelineStartTime
  // clip对应长度
  const clipDurationFrames =
    timelineItem.timeRange.clipEndTime - timelineItem.timeRange.clipStartTime
  // clip开始帧
  const startFrameInClip =
    timelineItem.timeRange.clipStartTime +
    Math.round(
      ((startFrame - timelineItem.timeRange.timelineStartTime) / tlDurationFrames) *
        clipDurationFrames,
    )
  // clip结束帧
  const endFrameInClip =
    timelineItem.timeRange.clipStartTime +
    Math.round(
      ((endFrame - timelineItem.timeRange.timelineStartTime) / tlDurationFrames) *
        clipDurationFrames,
    )

  const startPercent = startFrameInClip / clipWholeDurationFrames
  const endPercent = endFrameInClip / clipWholeDurationFrames

  const startIndex = Math.floor(startPercent * fullPcmData.length)
  const endIndex = Math.floor(endPercent * fullPcmData.length)

  return { pcmData: fullPcmData.subarray(startIndex, endIndex), startPercent, endPercent }
}

/**
 * 渲染波形到Canvas
 * @param ctx Canvas渲染上下文
 * @param data PCM采样数据
 * @param width 画布宽度
 * @param height 画布高度
 */
export function renderWaveformToCanvas(
  canvas: HTMLCanvasElement,
  data: {
    pcmData: Float32Array
    startPercent: number
    endPercent: number
  },
  width: number,
  height: number,
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return
  }

  // 保存当前Canvas状态
  ctx.save()

  const amplitude = 1.0

  // 清空画布
  ctx.clearRect(0, 0, width, height)

  // 设置基线位置，留出底部空间
  const baselineY = height - DEFAULT_TRACK_PADDING
  const sampleWidth = (data.endPercent - data.startPercent) * width
  const sampleStartX = data.startPercent * width
  const sampleEndX = data.endPercent * width
  const samplesPerPixel = data.pcmData.length / sampleWidth

  // 创建渐变色 - 从底部到顶部
  const gradient = ctx.createLinearGradient(0, baselineY, 0, 0)
  gradient.addColorStop(0, '#96ceb4')
  gradient.addColorStop(0.3, '#4ecdc4')
  gradient.addColorStop(0.6, '#45b7d1')
  gradient.addColorStop(1, '#ff6b6b')

  for (let x = 0; x < sampleWidth; x++) {
    let maxAmplitude = 0

    // 找到这个像素范围内的最大振幅（绝对值）
    const startSampleIndex = Math.floor(x * samplesPerPixel)
    const endSampleIndex = Math.floor((x + 1) * samplesPerPixel)

    for (let j = startSampleIndex; j < endSampleIndex && j < data.pcmData.length; j++) {
      const sample = Math.abs(data.pcmData[j])
      if (sample > maxAmplitude) {
        maxAmplitude = sample
      }
    }

    // 计算波形高度（从基线向上）
    const waveHeight = maxAmplitude * (baselineY - DEFAULT_TRACK_PADDING) * amplitude // 留出顶部空间
    const topY = baselineY - waveHeight

    // 绘制垂直线条（从基线向上），应用渐变色
    if (waveHeight > 1) {
      ctx.fillStyle = gradient
      ctx.fillRect(x + sampleStartX, topY, 1, waveHeight)
    }
  }

  // 绘制基线
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, baselineY)
  ctx.lineTo(width, baselineY)
  ctx.stroke()

  // 恢复Canvas状态
  ctx.restore()
}

/**
 * 实时波形渲染函数
 * @param canvas Canvas元素
 * @param audioClip AudioClip实例
 * @param viewportTLStartFrame 视口开始帧
 * @param viewportTLEndFrame 视口结束帧
 * @param clipWidthPixels Clip像素宽度
 * @param options 渲染选项
 */
export async function renderWaveformDirectly(
  canvas: HTMLCanvasElement,
  timelineItem: UnifiedTimelineItemData,
  viewportTLStartFrame: number,
  viewportTLEndFrame: number,
  clipWidthPixels: number,
  height: number,
): Promise<void> {
  const unifiedStore = useUnifiedStore()

  const width = clipWidthPixels

  // 确保Canvas物理尺寸正确
  if (canvas.width !== width) {
    canvas.width = width
  }
  if (canvas.height !== height) {
    canvas.height = height
  }

  try {
    const mediaItem = unifiedStore.getMediaItem(timelineItem.mediaItemId)
    if (!mediaItem?.webav?.audioClip) return

    const audioClip = mediaItem.webav.audioClip
    const meta = await audioClip.ready

    // 获取完整的PCM数据
    let fullPcmData: Float32Array
    try {
      // 获取完整的PCM数据
      const pcmData = audioClip.getPCMData()

      if (!pcmData || pcmData.length === 0) {
        // 没有数据，直接返回
        return
      }

      // 返回第一个声道的数据
      fullPcmData = pcmData[0]
    } catch (error) {
      console.error('获取PCM数据失败:', error)
      return
    }

    if (fullPcmData.length === 0) {
      return
    }

    // 裁剪PCM数据到当前视口范围
    const croppedData = preparePCMData(
      fullPcmData,
      timelineItem,
      microsecondsToFrames(meta.duration),
      viewportTLStartFrame,
      viewportTLEndFrame,
    )

    // 渲染波形
    renderWaveformToCanvas(canvas, croppedData, width, height)
  } catch (error) {
    console.error('波形渲染失败:', error)
    return
  }
}
