<template>
  <div class="playback-controls">
    <!-- 播放控制按钮 -->
    <div class="control-buttons">
      <HoverButton
        variant="primary"
        @click="togglePlayPause"
        :title="isPlaying ? t('common.pause') : t('common.play')"
      >
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
      <Dropdown>
        <template #trigger="{ toggle, isOpen }">
          <HoverButton @click="toggle" :title="t('common.playbackSpeed')" iconPosition="after">
            {{ playbackRate }}x
            <template #icon>
              <RemixIcon
                :name="isOpen ? 'arrow-up-s-line' : 'arrow-down-s-line'"
                size="xl"
                class="dropdown-arrow"
              />
            </template>
          </HoverButton>
        </template>
        <template #default="{ close }">
          <div class="speed-options">
            <button
              v-for="option in speedOptions"
              :key="option.value"
              @click="handleSpeedOptionClick(option.value, close)"
              :class="{ active: playbackRate === option.value }"
              class="speed-option"
            >
              {{ option.label }}
            </button>
          </div>
        </template>
      </Dropdown>
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
import Dropdown from '@/components/Dropdown.vue'

const unifiedStore = useUnifiedStore()
const { safePlaybackOperation, restartPlayback } = usePlaybackControls()
const { t } = useAppI18n()

const isPlaying = computed(() => unifiedStore.isPlaying)
const playbackRate = computed(() => unifiedStore.playbackRate)

// WebAV作为播放状态的主控
function togglePlayPause() {
  safePlaybackOperation(
    () => {
      if (isPlaying.value) {
        // 通过WebAV暂停，WebAV会触发事件更新store状态
        unifiedStore.webAVPause()
      } else {
        // 通过WebAV播放，WebAV会触发事件更新store状态
        unifiedStore.webAVPlay()
      }
    },
    t('common.play') + '/' + t('common.pause') + t('common.toggle'),
  )
}

function stop() {
  safePlaybackOperation(
    () => {
      // 暂停播放并跳转到开始位置
      unifiedStore.webAVPause()
      // 只通过WebAV设置时间，WebAV会触发timeupdate事件更新Store
      unifiedStore.webAVSeekTo(0)
    },
    t('common.stop') + t('common.playback'),
  )
}

const speedOptions = [
  { value: 0.25, label: '0.25x' },
  { value: 0.5, label: '0.5x' },
  { value: 0.75, label: '0.75x' },
  { value: 1, label: '1x' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
  { value: 2, label: '2x' },
  { value: 3, label: '3x' },
  { value: 4, label: '4x' },
  { value: 5, label: '5x' },
]

function handleSpeedOptionClick(newRate: number, close: () => void) {
  // 更新store中的播放速度
  unifiedStore.setPlaybackRate(newRate)

  // 如果正在播放，重新开始播放以应用新的播放速度
  restartPlayback()

  // 关闭下拉菜单
  close()
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
  position: relative;
}

.speed-toggle-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-sm);
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
  min-width: 60px;
  justify-content: space-between;
}

.speed-toggle-button:hover {
  border-color: var(--color-primary);
}

.speed-toggle-button.active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-alpha);
}

.dropdown-arrow {
  opacity: 0.7;
  transition: transform 0.2s ease;
}

.speed-toggle-button.active .dropdown-arrow {
  transform: rotate(180deg);
}

.speed-options {
  display: flex;
  flex-direction: column;
  min-width: 80px;
  max-height: 200px;
  overflow-y: auto;
}

.speed-option {
  padding: var(--spacing-xs) var(--spacing-sm);
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  transition: background-color 0.2s ease;
}

.speed-option:hover {
  background-color: var(--color-bg-tertiary);
}

.speed-option.active {
  background-color: var(--color-primary-alpha);
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
