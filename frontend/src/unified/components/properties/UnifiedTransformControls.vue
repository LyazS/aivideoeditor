<template>
  <div class="transform-controls">
    <!-- 位置大小 -->
    <div class="property-section">
      <div class="section-header">
        <h4>{{ t('properties.transform.positionSize') }}</h4>
      </div>

      <!-- 位置：XY在同一行 -->
      <div class="property-item">
        <label>{{ t('properties.transform.position') }}</label>
        <div class="position-controls">
          <div class="position-input-group">
            <span class="position-label">{{ t('properties.transform.positionX') }}</span>
            <NumberInput
              :model-value="transformX"
              @change="(value) => $emit('update-transform', { x: value })"
              :disabled="!canOperateTransforms"
              :min="positionLimits.minX"
              :max="positionLimits.maxX"
              :step="1"
              :precision="0"
              :placeholder="t('properties.transform.centerFor0')"
              input-class="position-input"
            />
          </div>
          <div class="position-input-group">
            <span class="position-label">{{ t('properties.transform.positionY') }}</span>
            <NumberInput
              :model-value="transformY"
              @change="(value) => $emit('update-transform', { y: value })"
              :disabled="!canOperateTransforms"
              :min="positionLimits.minY"
              :max="positionLimits.maxY"
              :step="1"
              :precision="0"
              :placeholder="t('properties.transform.centerFor0')"
              input-class="position-input"
            />
          </div>
        </div>
      </div>
      <!-- 水平对齐 -->
      <div class="property-item">
        <label>{{ t('properties.transform.alignHorizontal') }}</label>
        <div class="alignment-controls">
          <button
            @click="$emit('align-horizontal', 'left')"
            :disabled="!canOperateTransforms"
            class="align-btn"
            :title="t('properties.transform.left')"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="2" y="4" width="8" height="2" />
              <rect x="2" y="7" width="6" height="2" />
              <rect x="2" y="10" width="10" height="2" />
              <line x1="1" y1="2" x2="1" y2="14" stroke="currentColor" stroke-width="1" />
            </svg>
          </button>
          <button
            @click="$emit('align-horizontal', 'center')"
            :disabled="!canOperateTransforms"
            class="align-btn"
            :title="t('properties.transform.center')"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="4" y="4" width="8" height="2" />
              <rect x="5" y="7" width="6" height="2" />
              <rect x="3" y="10" width="10" height="2" />
              <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" stroke-width="1" />
            </svg>
          </button>
          <button
            @click="$emit('align-horizontal', 'right')"
            :disabled="!canOperateTransforms"
            class="align-btn"
            :title="t('properties.transform.right')"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="6" y="4" width="8" height="2" />
              <rect x="8" y="7" width="6" height="2" />
              <rect x="4" y="10" width="10" height="2" />
              <line x1="15" y1="2" x2="15" y2="14" stroke="currentColor" stroke-width="1" />
            </svg>
          </button>
        </div>
      </div>

      <!-- 垂直对齐 -->
      <div class="property-item">
        <label>{{ t('properties.transform.alignVertical') }}</label>
        <div class="alignment-controls">
          <button
            @click="$emit('align-vertical', 'top')"
            :disabled="!canOperateTransforms"
            class="align-btn"
            :title="t('properties.transform.top')"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="4" y="2" width="2" height="8" />
              <rect x="7" y="2" width="2" height="6" />
              <rect x="10" y="2" width="2" height="10" />
              <line x1="2" y1="1" x2="14" y2="1" stroke="currentColor" stroke-width="1" />
            </svg>
          </button>
          <button
            @click="$emit('align-vertical', 'middle')"
            :disabled="!canOperateTransforms"
            class="align-btn"
            :title="t('properties.transform.middle')"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="4" y="4" width="2" height="8" />
              <rect x="7" y="5" width="2" height="6" />
              <rect x="10" y="3" width="2" height="10" />
              <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1" />
            </svg>
          </button>
          <button
            @click="$emit('align-vertical', 'bottom')"
            :disabled="!canOperateTransforms"
            class="align-btn"
            :title="t('properties.transform.bottom')"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="4" y="6" width="2" height="8" />
              <rect x="7" y="8" width="2" height="6" />
              <rect x="10" y="4" width="2" height="10" />
              <line x1="2" y1="15" x2="14" y2="15" stroke="currentColor" stroke-width="1" />
            </svg>
          </button>
        </div>
      </div>
      <!-- 等比缩放选项 -->
      <div class="property-item">
        <label>{{ t('properties.transform.proportionalScale') }}</label>
        <input
          :checked="proportionalScale"
          @change="$emit('toggle-proportional-scale')"
          :disabled="!canOperateTransforms"
          type="checkbox"
          class="checkbox-input"
        />
      </div>

      <!-- 等比缩放时的统一缩放控制 -->
      <div v-if="proportionalScale" class="property-item">
        <label>{{ t('properties.transform.scale') }}</label>
        <div class="scale-controls">
          <SliderInput
            :model-value="uniformScale"
            @input="(value) => $emit('update-uniform-scale', value)"
            :disabled="!canOperateTransforms"
            :min="0.01"
            :max="5"
            :step="0.01"
          />
          <NumberInput
            :model-value="uniformScale"
            @change="(value) => $emit('update-uniform-scale', value)"
            :disabled="!canOperateTransforms"
            :min="0.01"
            :max="5"
            :step="0.01"
            :precision="2"
            :show-controls="false"
            input-class="scale-input"
          />
        </div>
      </div>

      <!-- 非等比缩放时的独立XY缩放控制 -->
      <template v-else>
        <div class="property-item">
          <label>{{ t('properties.transform.scaleX') }}</label>
          <div class="scale-controls">
            <SliderInput
              :model-value="scaleX"
              @input="(value) => $emit('set-scale-x', value)"
              :disabled="!canOperateTransforms"
              :min="0.01"
              :max="5"
              :step="0.01"
            />
            <NumberInput
              :model-value="scaleX"
              @change="(value) => $emit('set-scale-x', value)"
              :disabled="!canOperateTransforms"
              :min="0.01"
              :max="5"
              :step="0.01"
              :precision="2"
              :show-controls="false"
              input-class="scale-input"
            />
          </div>
        </div>
        <div class="property-item">
          <label>{{ t('properties.transform.scaleY') }}</label>
          <div class="scale-controls">
            <SliderInput
              :model-value="scaleY"
              @input="(value) => $emit('set-scale-y', value)"
              :disabled="!canOperateTransforms"
              :min="0.01"
              :max="5"
              :step="0.01"
            />
            <NumberInput
              :model-value="scaleY"
              @change="(value) => $emit('set-scale-y', value)"
              :disabled="!canOperateTransforms"
              :min="0.01"
              :max="5"
              :step="0.01"
              :precision="2"
              :show-controls="false"
              input-class="scale-input"
            />
          </div>
        </div>
      </template>
      <!-- 缩放预设按钮 -->
      <div class="property-item">
        <label>{{ t('properties.transform.scalePresets') }}</label>
        <div class="scale-preset-controls">
          <button @click="handleFitToCanvas" :disabled="!canOperateTransforms" class="preset-btn">
            {{ t('properties.transform.fitToCanvas') }}
          </button>
          <button @click="handleFillCanvas" :disabled="!canOperateTransforms" class="preset-btn">
            {{ t('properties.transform.fillCanvas') }}
          </button>
        </div>
      </div>
    </div>

    <!-- 变换属性 -->
    <div class="property-section">
      <h4>{{ t('properties.transform.transform') }}</h4>

      <div class="property-item">
        <label>{{ t('properties.transform.rotation') }}</label>
        <div class="rotation-controls">
          <SliderInput
            :model-value="rotation"
            @input="(value) => $emit('set-rotation', value)"
            :disabled="!canOperateTransforms"
            :min="-180"
            :max="180"
            :step="0.1"
            slider-class="rotation-slider"
          />
          <NumberInput
            :model-value="rotation"
            @change="(value) => $emit('set-rotation', value)"
            :disabled="!canOperateTransforms"
            :step="1"
            :precision="1"
            :show-controls="false"
            input-class="scale-input"
          />
        </div>
      </div>

      <div class="property-item">
        <label>{{ t('properties.transform.opacity') }}</label>
        <div class="opacity-controls">
          <SliderInput
            :model-value="opacity"
            @input="(value) => $emit('set-opacity', value)"
            :disabled="!canOperateTransforms"
            :min="0"
            :max="1"
            :step="0.01"
            slider-class="opacity-slider"
          />
          <NumberInput
            :model-value="opacity"
            @change="(value) => $emit('set-opacity', value)"
            :disabled="!canOperateTransforms"
            :min="0"
            :max="1"
            :step="0.01"
            :precision="2"
            :show-controls="false"
            input-class="scale-input"
          />
        </div>
      </div>

      <div class="property-item">
        <label>{{ t('properties.transform.zIndex') }}</label>
        <NumberInput
          :model-value="zIndex"
          @change="(value) => $emit('update-transform', { zIndex: value })"
          :disabled="!canOperateTransforms"
          :min="0"
          :step="1"
          :precision="0"
          :show-controls="false"
          input-class="scale-input"
          :placeholder="t('properties.transform.layer')"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppI18n } from '@/unified/composables/useI18n'
import { useUnifiedStore } from '@/unified/unifiedStore'
import NumberInput from '@/components/NumberInput.vue'
import SliderInput from '@/components/SliderInput.vue'

const { t } = useAppI18n()
const unifiedStore = useUnifiedStore()

interface Props {
  // 变换属性
  transformX: number
  transformY: number
  scaleX: number
  scaleY: number
  rotation: number
  opacity: number
  zIndex: number

  // 缩放相关
  proportionalScale: boolean
  uniformScale: number

  // 元素原始尺寸（用于缩放预设）
  elementWidth: number
  elementHeight: number

  // 操作状态
  canOperateTransforms: boolean

  // 位置限制
  positionLimits: {
    minX: number
    maxX: number
    minY: number
    maxY: number
  }
}

interface Emits {
  (e: 'update-transform', transform: { x?: number; y?: number; zIndex?: number }): void
  (e: 'toggle-proportional-scale'): void
  (e: 'update-uniform-scale', value: number): void
  (e: 'set-scale-x', value: number): void
  (e: 'set-scale-y', value: number): void
  (e: 'set-rotation', value: number): void
  (e: 'set-opacity', value: number): void
  (e: 'align-horizontal', alignment: 'left' | 'center' | 'right'): void
  (e: 'align-vertical', alignment: 'top' | 'middle' | 'bottom'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 处理适应画布按钮点击
const handleFitToCanvas = () => {
  const { elementWidth, elementHeight } = props

  if (elementWidth <= 0 || elementHeight <= 0) {
    console.warn('无法计算缩放：元素尺寸无效', { elementWidth, elementHeight })
    return
  }

  // 获取画布尺寸
  const canvasWidth = unifiedStore.videoResolution.width
  const canvasHeight = unifiedStore.videoResolution.height

  // 计算适应画布的缩放比例（最小比例，确保元素完全显示在画布内）
  const scale = Math.min(canvasWidth / elementWidth, canvasHeight / elementHeight)

  console.log(
    `适应画布：元素尺寸 ${elementWidth}x${elementHeight}, 画布尺寸 ${canvasWidth}x${canvasHeight}, 缩放比例 ${scale}`,
  )

  emit('update-uniform-scale', scale)
}

// 处理填满画布按钮点击
const handleFillCanvas = () => {
  const { elementWidth, elementHeight } = props

  if (elementWidth <= 0 || elementHeight <= 0) {
    console.warn('无法计算缩放：元素尺寸无效', { elementWidth, elementHeight })
    return
  }

  // 获取画布尺寸
  const canvasWidth = unifiedStore.videoResolution.width
  const canvasHeight = unifiedStore.videoResolution.height

  // 计算填满画布的缩放比例（最大比例，确保画布被完全覆盖）
  const scale = Math.max(canvasWidth / elementWidth, canvasHeight / elementHeight)

  console.log(
    `填满画布：元素尺寸 ${elementWidth}x${elementHeight}, 画布尺寸 ${canvasWidth}x${canvasHeight}, 缩放比例 ${scale}`,
  )

  emit('update-uniform-scale', scale)
}
</script>

<style scoped>
.transform-controls {
  width: 100%;
}

/* 使用全局样式 styles/components/panels.css 中定义的 property-section, property-item, section-header 样式 */

.position-controls {
  display: flex;
  gap: var(--spacing-xs);
  flex: 1;
}

.position-input-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex: 1;
}

.position-label {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  min-width: 12px;
}

.checkbox-input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-text-primary);
  cursor: pointer;
}

.scale-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex: 1;
}

.scale-preset-controls {
  display: flex;
  gap: var(--spacing-xs);
  flex: 1;
}

.alignment-controls {
  display: flex;
  gap: var(--spacing-xs);
}

.align-btn {
  background: var(--color-bg-active);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--border-radius-medium);
  color: var(--color-text-secondary);
  padding: var(--spacing-xs);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  flex: 1;
  min-width: 28px;
  height: 24px;
}

.preset-btn {
  background: var(--color-bg-active);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--border-radius-medium);
  color: var(--color-text-secondary);
  padding: var(--spacing-xs) var(--spacing-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: all var(--transition-fast);
  flex: 1;
  min-height: 24px;
}

.preset-btn:hover {
  background: var(--color-border-secondary);
  color: var(--color-text-primary);
  border-color: var(--color-border-hover);
}

.preset-btn:active {
  background: var(--color-border-hover);
  transform: translateY(1px);
}

.align-btn:hover {
  background: var(--color-border-secondary);
  color: var(--color-text-primary);
  border-color: var(--color-border-hover);
}

.align-btn:active {
  background: var(--color-border-hover);
  transform: translateY(1px);
}

.align-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: var(--color-bg-disabled);
  color: var(--color-text-disabled);
  border-color: var(--color-border-disabled);
  box-shadow: none;
}

.align-btn:disabled:hover {
  transform: none;
  box-shadow: none;
}

.align-btn svg {
  width: 14px;
  height: 14px;
}

.rotation-controls,
.opacity-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex: 1;
}

/* 禁用状态样式 */
.transform-controls input:disabled,
.transform-controls button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: var(--color-bg-disabled);
  color: var(--color-text-disabled);
  border-color: var(--color-border-disabled);
  box-shadow: none;
}

.transform-controls input:disabled:hover,
.transform-controls button:disabled:hover {
  transform: none;
  box-shadow: none;
}

.preset-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: var(--color-bg-disabled);
  color: var(--color-text-disabled);
  border-color: var(--color-border-disabled);
  box-shadow: none;
}

.preset-btn:disabled:hover {
  background: var(--color-bg-disabled);
  border-color: var(--color-border-disabled);
  transform: none;
  box-shadow: none;
}

/* 位置输入框样式 */
.position-input {
  max-width: 60px;
  text-align: center;
  flex: 1;
}

/* 缩放输入框样式 */
.scale-input {
  background: var(--color-bg-quaternary);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  padding: 2px var(--spacing-xs);
  width: 78px;
  text-align: center;
  flex: 0 0 auto;
}
</style>
