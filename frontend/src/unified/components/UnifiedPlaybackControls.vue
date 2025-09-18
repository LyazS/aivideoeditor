<template>
  <div class="playback-controls">
    <!-- 播放控制按钮 -->
    <div class="control-buttons">
      <HoverButton variant="primary" @click="togglePlayPause" :title="isPlaying ? t('common.pause') : t('common.play')">
        <template #icon>
          <RemixIcon :name="isPlaying ? 'pause-large-fill' : 'play-large-fill'" size="lg" />
        </template>
      </HoverButton>

      <HoverButton @click="stop" :title="t('common.stop')">
        <template #icon>
          <RemixIcon name="stop-large-fill" size="md" />
        </template>
      </HoverButton>
    </div>

    <!-- 播放速度控制 -->
    <div class="speed-control">
      <select @change="handleSpeedChange" :value="playbackRate" :title="t('common.playbackSpeed')">
        <option value="0.25">0.25x</option>
        <option value="0.5">0.5x</option>
        <option value="0.75">0.75x</option>
        <option value="1">1x</option>
        <option value="1.25">1.25x</option>
        <option value="1.5">1.5x</option>
        <option value="2">2x</option>
        <option value="3">3x</option>
        <option value="4">4x</option>
        <option value="5">5x</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUnifiedStore } from '@/unified/unifiedStore'
import { usePlaybackControls } from '@/unified/composables'
import { useAppI18n } from '@/unified/composables/useI18n'
import HoverButton from '@/components/HoverButton.vue'
import RemixIcon from '@/components/icons/RemixIcon.vue'

const unifiedStore = useUnifiedStore()
const { safePlaybackOperation, restartPlayback } = usePlaybackControls()
const { t } = useAppI18n()

const isPlaying = computed(() => unifiedStore.isPlaying)
const playbackRate = computed(() => unifiedStore.playbackRate)

// WebAV作为播放状态的主控
function togglePlayPause() {
  safePlaybackOperation(() => {
    if (isPlaying.value) {
      // 通过WebAV暂停，WebAV会触发事件更新store状态
      unifiedStore.webAVPause()
    } else {
      // 通过WebAV播放，WebAV会触发事件更新store状态
      unifiedStore.webAVPlay()
    }
  }, t('common.play') + '/' + t('common.pause') + t('common.toggle'))
}

function stop() {
  safePlaybackOperation(() => {
    // 暂停播放并跳转到开始位置
    unifiedStore.webAVPause()
    // 只通过WebAV设置时间，WebAV会触发timeupdate事件更新Store
    unifiedStore.webAVSeekTo(0)
  }, t('common.stop') + t('common.playback'))
}

function handleSpeedChange(event: Event) {
  const target = event.target as HTMLSelectElement
  const newRate = parseFloat(target.value)

  // 更新store中的播放速度
  unifiedStore.setPlaybackRate(newRate)

  // 如果正在播放，重新开始播放以应用新的播放速度
  restartPlayback()
}
</script>

<style scoped>
.playback-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: 0 var(--spacing-md);
  background-color: var(--color-bg-secondary);
  border-radius: var(--border-radius-large);
  height: 100%;
  min-height: 50px;
  min-width: 200px;
  overflow: hidden;
  justify-content: center;
}

.control-buttons {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.speed-control {
  margin-left: var(--spacing-md);
}

.speed-control select {
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-sm);
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
}

.speed-control select:hover {
  border-color: var(--color-primary);
}

.speed-control select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-alpha);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .playback-controls {
    min-width: 150px;
    gap: var(--spacing-sm);
    padding: 0 var(--spacing-sm);
  }

  .speed-control {
    margin-left: var(--spacing-sm);
  }

  .speed-control select {
    font-size: var(--font-size-xs);
    padding: var(--spacing-xs);
  }
}
</style>
