<template>
  <div class="audio-clip-properties">
    <div class="property-section">
      <h3>音频属性</h3>
      
      <!-- 音量控制 -->
      <div class="property-group">
        <label>音量</label>
        <div class="volume-control">
          <SliderInput
            v-model="localVolume"
            :min="0"
            :max="1"
            :step="0.01"
            @change="updateAudioProperties"
          />
          <span class="volume-value">{{ Math.round(localVolume * 100) }}%</span>
        </div>
      </div>
      
      <!-- 静音开关 -->
      <div class="property-group">
        <label>
          <input
            type="checkbox"
            v-model="localMuted"
            @change="updateAudioProperties"
          />
          静音
        </label>
      </div>
      
      <!-- 播放速度 -->
      <div class="property-group">
        <label>播放速度</label>
        <div class="speed-control">
          <SliderInput
            v-model="localPlaybackRate"
            :min="0.5"
            :max="2.0"
            :step="0.1"
            @change="updateAudioProperties"
          />
          <span class="speed-value">{{ localPlaybackRate.toFixed(1) }}x</span>
        </div>
      </div>

      <!-- 音频增益 -->
      <div class="property-group">
        <label>增益 (dB)</label>
        <div class="gain-control">
          <SliderInput
            v-model="localGain"
            :min="-20"
            :max="20"
            :step="1"
            @change="updateAudioProperties"
          />
          <span class="gain-value">{{ localGain }}dB</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import SliderInput from './SliderInput.vue'
import type { TimelineItem, AudioMediaConfig, VideoTimeRange } from '../types'

interface Props {
  selectedTimelineItem: TimelineItem<'audio'> | null
  currentFrame: number
}

const props = defineProps<Props>()
const videoStore = useVideoStore()

// 本地状态管理
const localVolume = ref(1)
const localMuted = ref(false)
const localPlaybackRate = ref(1)
const localGain = ref(0)

// 监听选中项目变化，同步本地状态
watch(
  () => props.selectedTimelineItem,
  (newItem) => {
    if (newItem && newItem.mediaType === 'audio') {
      const config = newItem.config
      const timeRange = newItem.timeRange as VideoTimeRange
      
      localVolume.value = config.volume
      localMuted.value = config.isMuted
      localPlaybackRate.value = timeRange.playbackRate || 1
      
      // 从AudioVisibleSprite获取增益值
      const sprite = newItem.sprite as any
      if (sprite && typeof sprite.getGain === 'function') {
        localGain.value = sprite.getGain()
      } else {
        localGain.value = 0
      }
    }
  },
  { immediate: true }
)

// 更新音频属性
const updateAudioProperties = async () => {
  if (!props.selectedTimelineItem) {
    return
  }

  try {
    console.log('🔄 [AudioClipProperties] 开始更新音频属性...')

    // 导入音频命令
    const { UpdateAudioPropertiesCommand } = await import('../stores/modules/commands/audioCommands')

    // 创建更新命令
    const command = new UpdateAudioPropertiesCommand(
      props.selectedTimelineItem.id,
      {
        volume: localVolume.value,
        isMuted: localMuted.value,
        playbackRate: localPlaybackRate.value,
        gain: localGain.value,
      },
      {
        getTimelineItem: videoStore.getTimelineItem,
      }
    )

    // 执行命令（带历史记录）
    await videoStore.executeCommand(command)

    console.log('✅ [AudioClipProperties] 音频属性更新成功')
  } catch (error) {
    console.error('❌ [AudioClipProperties] 更新音频属性失败:', error)
    videoStore.showError('更新失败', '音频属性更新失败，请重试')
  }
}
</script>

<style scoped>
.audio-clip-properties {
  padding: 16px;
}

.property-section {
  margin-bottom: 24px;
}

.property-section h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.property-group {
  margin-bottom: 12px;
}

.property-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.volume-control,
.speed-control,
.gain-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.volume-value,
.speed-value,
.gain-value {
  font-size: 11px;
  color: var(--color-text-secondary);
  min-width: 40px;
}

/* 复选框样式 */
.property-group label input[type="checkbox"] {
  margin-right: 8px;
}
</style>
