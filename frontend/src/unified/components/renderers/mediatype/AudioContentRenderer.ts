/**
 * 音频内容渲染器
 * 处理ready状态下音频类型的内容渲染
 * 
 * 设计理念：
 * - 专门处理音频类型的显示
 * - 提供波形预览和音量信息
 * - 支持静音指示和音频属性显示
 * - 优化音频项目的视觉表现
 */

import { h } from 'vue'
import type { VNode } from 'vue'
import type { ContentRenderer, ContentRenderContext } from '../../../types/clipRenderer'
import type { UnifiedTimelineItemData } from '../../../timelineitem/TimelineItemData'
import { getTimelineItemDisplayName } from '../../../utils/clipUtils'

/**
 * 音频内容渲染器
 */
export class AudioContentRenderer implements ContentRenderer<'audio'> {
  readonly type = 'audio' as const

  renderContent(context: ContentRenderContext<'audio'>): VNode {
    const { data, isSelected, scale } = context

    return h('div', {
      class: ['audio-content', { selected: isSelected }]
    }, [
      // 波形显示
      this.renderWaveform(data, scale),
      // 音频信息覆盖层
      this.renderAudioOverlay(data),
      // 音量和静音指示器
      this.renderAudioIndicators(data)
    ])
  }

  getCustomClasses(context: ContentRenderContext<'audio'>): string[] {
    const { data } = context
    const classes = ['audio-renderer']

    // 添加音频状态相关的类
    if (this.isMuted(data)) {
      classes.push('muted')
    }

    if (this.hasVolumeAdjustment(data)) {
      classes.push('volume-adjusted')
    }

    return classes
  }

  getCustomStyles(context: ContentRenderContext<'audio'>): Record<string, string | number> {
    return {
      background: 'linear-gradient(135deg, #fff7e6 0%, #ffd591 100%)'
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 渲染波形
   */
  private renderWaveform(data: UnifiedTimelineItemData<'audio'>, scale: number): VNode {
    const waveformData = this.getWaveformData(data)
    
    if (waveformData && waveformData.length > 0) {
      return this.renderWaveformBars(waveformData, scale)
    }

    // 如果没有波形数据，显示占位符
    return this.renderWaveformPlaceholder(data)
  }

  /**
   * 渲染波形条
   */
  private renderWaveformBars(waveformData: number[], scale: number): VNode {
    const barCount = Math.min(waveformData.length, Math.floor(200 * scale))
    const step = Math.max(1, Math.floor(waveformData.length / barCount))
    
    const bars = []
    for (let i = 0; i < barCount; i++) {
      const dataIndex = i * step
      const amplitude = waveformData[dataIndex] || 0
      const height = Math.max(2, amplitude * 100) // 最小高度2px，最大100px
      
      bars.push(
        h('div', {
          key: i,
          class: 'waveform-bar',
          style: {
            height: `${height}%`,
            width: `${100 / barCount}%`
          }
        })
      )
    }

    return h('div', { class: 'waveform-container' }, bars)
  }

  /**
   * 渲染波形占位符
   */
  private renderWaveformPlaceholder(data: UnifiedTimelineItemData<'audio'>): VNode {
    // 生成模拟波形
    const barCount = 50
    const bars = []
    
    for (let i = 0; i < barCount; i++) {
      // 生成随机高度，模拟音频波形
      const height = Math.random() * 80 + 10 // 10-90%的高度
      
      bars.push(
        h('div', {
          key: i,
          class: 'waveform-bar placeholder',
          style: {
            height: `${height}%`,
            width: `${100 / barCount}%`
          }
        })
      )
    }

    return h('div', { class: 'waveform-container placeholder' }, bars)
  }

  /**
   * 渲染音频覆盖层
   */
  private renderAudioOverlay(data: UnifiedTimelineItemData<'audio'>): VNode {
    return h('div', { class: 'audio-overlay' }, [
      // 音频图标
      this.renderAudioIcon(),
      // 时间显示
      this.renderTimeDisplay(data),
      // 文件名显示
      this.renderFileName(data)
    ])
  }

  /**
   * 渲染音频图标
   */
  private renderAudioIcon(): VNode {
    return h('div', { class: 'audio-icon' }, '🎵')
  }

  /**
   * 渲染时间显示
   */
  private renderTimeDisplay(data: UnifiedTimelineItemData<'audio'>): VNode {
    const duration = this.getDuration(data)
    const timeText = this.formatTime(duration)

    return h('div', { class: 'time-display' }, [
      h('span', { class: 'time-text' }, timeText)
    ])
  }

  /**
   * 渲染文件名
   */
  private renderFileName(data: UnifiedTimelineItemData<'audio'>): VNode {
    const name = getTimelineItemDisplayName(data)
    const displayName = name.length > 15 ? name.substring(0, 15) + '...' : name

    return h('div', { class: 'file-name' }, [
      h('span', { class: 'name-text' }, displayName)
    ])
  }

  /**
   * 渲染音频指示器
   */
  private renderAudioIndicators(data: UnifiedTimelineItemData<'audio'>): VNode {
    return h('div', { class: 'audio-indicators' }, [
      // 音量指示器
      this.renderVolumeIndicator(data),
      // 静音指示器
      this.renderMuteIndicator(data)
    ])
  }

  /**
   * 渲染音量指示器
   */
  private renderVolumeIndicator(data: UnifiedTimelineItemData<'audio'>): VNode | null {
    const volume = this.getVolume(data)
    
    if (volume === 1.0) {
      // 默认音量不显示指示器
      return null
    }

    const volumePercent = Math.round(volume * 100)
    const volumeIcon = volume > 0.7 ? '🔊' : volume > 0.3 ? '🔉' : '🔈'

    return h('div', { class: 'volume-indicator' }, [
      h('span', { class: 'volume-icon' }, volumeIcon),
      h('span', { class: 'volume-text' }, `${volumePercent}%`)
    ])
  }

  /**
   * 渲染静音指示器
   */
  private renderMuteIndicator(data: UnifiedTimelineItemData<'audio'>): VNode | null {
    if (!this.isMuted(data)) {
      return null
    }

    return h('div', { class: 'mute-indicator' }, [
      h('span', { class: 'mute-icon' }, '🔇'),
      h('span', { class: 'mute-text' }, '静音')
    ])
  }

  // ==================== 辅助方法 ====================

  /**
   * 获取波形数据
   */
  private getWaveformData(data: UnifiedTimelineItemData<'audio'>): number[] | null {
    // 这里需要通过mediaItemId获取关联的媒体项目数据来获取波形数据
    // 暂时返回null，实际实现需要从store或管理器中获取
    return null
  }

  /**
   * 获取持续时间
   */
  private getDuration(data: UnifiedTimelineItemData<'audio'>): number {
    // 计算时间轴项目的持续时间（帧数）
    return data.timeRange.timelineEndTime - data.timeRange.timelineStartTime
  }

  /**
   * 格式化时间显示
   */
  private formatTime(frames: number): string {
    // 假设30fps
    const seconds = frames / 30
    
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`
    }
    
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  /**
   * 获取音量
   */
  private getVolume(data: UnifiedTimelineItemData<'audio'>): number {
    // 从配置中获取音量设置
    return (data.config as any)?.volume || 1.0
  }

  /**
   * 检查是否静音
   */
  private isMuted(data: UnifiedTimelineItemData<'audio'>): boolean {
    // 从配置中获取静音设置
    return (data.config as any)?.isMuted || false
  }

  /**
   * 检查是否有音量调整
   */
  private hasVolumeAdjustment(data: UnifiedTimelineItemData<'audio'>): boolean {
    const volume = this.getVolume(data)
    return volume !== 1.0
  }
}
