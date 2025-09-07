/**
 * 音频波形渲染工具函数
 * 基于直接PCM数据获取的简化音频波形渲染方案
 */

import { framesToMicroseconds } from './timeUtils'
import type { AudioClip } from '@webav/av-cliper'
import type { UnifiedTimelineItemData } from '../timelineitem'
import { useUnifiedStore } from '@/unified/unifiedStore'

export interface RenderOptions {
  /** 波形高度 */
  height: number
  /** 波形振幅系数 */
  amplitude: number
  /** 波形颜色 */
  waveColor: string
  /** 线条宽度 */
  lineWidth: number
}

/**
 * 获取音频波形数据
 * @param audioClip AudioClip实例
 * @returns 第一个声道的PCM数据
 */
function getWaveformDataDirectly(audioClip: AudioClip): Float32Array {
  try {
    // 获取完整的PCM数据
    const pcmData = audioClip.getPCMData()

    if (!pcmData || pcmData.length === 0) {
      return new Float32Array()
    }

    // 返回第一个声道的数据
    return pcmData[0]
  } catch (error) {
    console.error('获取PCM数据失败:', error)
    return new Float32Array()
  }
}

/**
 * 将完整的PCM数据裁剪到指定时间范围
 * @param fullPcmData 完整的PCM数据
 * @param totalDurationFrames 总时长（帧数）
 * @param startFrame 开始帧
 * @param endFrame 结束帧
 * @returns 裁剪后的PCM数据
 */
export function cropPCMDataToTimeRange(
  fullPcmData: Float32Array,
  totalDurationFrames: number,
  startFrame: number,
  endFrame: number,
): Float32Array {
  if (!fullPcmData || fullPcmData.length === 0) {
    return new Float32Array()
  }

  const startSample = Math.floor((startFrame / totalDurationFrames) * fullPcmData.length)
  const endSample = Math.floor((endFrame / totalDurationFrames) * fullPcmData.length)

  // 确保索引在有效范围内
  const safeStart = Math.max(0, Math.min(startSample, fullPcmData.length - 1))
  const safeEnd = Math.max(safeStart + 1, Math.min(endSample, fullPcmData.length))

  return fullPcmData.subarray(safeStart, safeEnd)
}

/**
 * 渲染波形到Canvas
 * @param ctx Canvas渲染上下文
 * @param samples PCM采样数据
 * @param width 画布宽度
 * @param height 画布高度
 * @param options 渲染选项
 */
export function renderWaveformToCanvas(
  canvas: HTMLCanvasElement,
  samples: Float32Array,
  width: number,
  height: number,
  options: RenderOptions,
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return
  }

  // 合并选项与默认值
  const mergedOptions = { ...options }

  // 保存当前Canvas状态
  ctx.save()

  const centerY = height / 2
  const amplitude = mergedOptions.amplitude
  const waveColor = mergedOptions.waveColor
  const lineWidth = mergedOptions.lineWidth

  // 清空画布
  ctx.clearRect(0, 0, width, height)

  const sampleSpacing = samples.length / width

  // 绘制波形线
  ctx.beginPath()
  for (let i = 0; i < width; i++) {
    const x = i
    const sampleIndex = Math.floor(i * sampleSpacing)
    const sampleValue = samples[sampleIndex]
    const y = centerY - sampleValue * centerY * amplitude

    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }

  ctx.strokeStyle = waveColor
  ctx.lineWidth = lineWidth
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
  options: RenderOptions,
): Promise<void> {
  const unifiedStore = useUnifiedStore()
  // 合并选项与默认值
  const mergedOptions = { ...options }

  const width = clipWidthPixels
  const height = mergedOptions.height

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
    const fullPcmData = await getWaveformDataDirectly(audioClip)

    if (fullPcmData.length === 0) {
      return
    }

    // 获取音频总时长信息（需要从audioClip的meta信息中获取）
    let totalDurationFrames = 0
    try {
      // 将微秒转换为帧数
      totalDurationFrames = Math.floor((meta.duration / 1_000_000) * 30) // 假设30fps
    } catch {
      // 如果无法获取meta信息，使用默认值
      totalDurationFrames = viewportTLEndFrame - viewportTLStartFrame
    }

    // 裁剪PCM数据到当前视口范围
    const croppedData = cropPCMDataToTimeRange(
      fullPcmData,
      totalDurationFrames,
      viewportTLStartFrame,
      viewportTLEndFrame,
    )

    // 渲染波形
    renderWaveformToCanvas(canvas, croppedData, width, height, mergedOptions as RenderOptions)
  } catch (error) {
    console.error('波形渲染失败:', error)
    return
  }
}
