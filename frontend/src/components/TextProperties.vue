<template>
  <div class="text-properties">
    <!-- 文本内容编辑 -->
    <div class="property-section">
      <h4 class="section-title">文本内容</h4>
      <div class="property-group">
        <label>内容</label>
        <textarea
          v-model="localTextContent"
          @blur="handleTextConfirm"
          @keydown.enter="handleTextConfirm"
          placeholder="输入文本内容..."
          class="text-input"
          rows="3"
        />
      </div>
    </div>

    <!-- 字体样式 -->
    <div class="property-section">
      <h4 class="section-title">字体样式</h4>

      <div class="property-group">
        <label>字体族</label>
        <select v-model="localConfig.style.fontFamily" @change="handleStyleChange">
          <option value="Arial, sans-serif">Arial</option>
          <option value="'Microsoft YaHei', sans-serif">微软雅黑</option>
          <option value="'SimSun', serif">宋体</option>
          <option value="'SimHei', sans-serif">黑体</option>
          <option value="'Helvetica Neue', sans-serif">Helvetica Neue</option>
          <option value="'Times New Roman', serif">Times New Roman</option>
        </select>
      </div>

      <div class="property-group">
        <label>字体大小</label>
        <div class="range-input">
          <input
            type="range"
            v-model.number="localConfig.style.fontSize"
            min="12" max="120"
            @input="handleStyleChange"
          />
          <span class="value">{{ localConfig.style.fontSize }}px</span>
        </div>
      </div>

      <div class="property-group">
        <label>字重</label>
        <select v-model="localConfig.style.fontWeight" @change="handleStyleChange">
          <option value="normal">正常</option>
          <option value="bold">粗体</option>
          <option value="lighter">细体</option>
          <option value="100">100</option>
          <option value="200">200</option>
          <option value="300">300</option>
          <option value="400">400</option>
          <option value="500">500</option>
          <option value="600">600</option>
          <option value="700">700</option>
          <option value="800">800</option>
          <option value="900">900</option>
        </select>
      </div>

      <div class="property-group">
        <label>字体样式</label>
        <select v-model="localConfig.style.fontStyle" @change="handleStyleChange">
          <option value="normal">正常</option>
          <option value="italic">斜体</option>
        </select>
      </div>

      <div class="property-group">
        <label>对齐方式</label>
        <div class="align-buttons">
          <button
            v-for="align in ['left', 'center', 'right']"
            :key="align"
            :class="{ active: localConfig.style.textAlign === align }"
            @click="setTextAlign(align)"
          >
            {{ alignLabels[align] }}
          </button>
        </div>
      </div>
    </div>

    <!-- 颜色和效果 -->
    <div class="property-section">
      <h4 class="section-title">颜色和效果</h4>

      <div class="property-group">
        <label>文字颜色</label>
        <div class="color-input">
          <input
            type="color"
            v-model="localConfig.style.color"
            @change="handleStyleChange"
          />
          <span class="color-value">{{ localConfig.style.color }}</span>
        </div>
      </div>

      <div class="property-group">
        <label>背景颜色</label>
        <div class="color-input">
          <input
            type="color"
            v-model="backgroundColorValue"
            @change="handleBackgroundColorChange"
            :disabled="!hasBackground"
          />
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="hasBackground"
              @change="toggleBackground"
            />
            <span>启用背景</span>
          </label>
        </div>
      </div>

      <div class="property-group">
        <label>行高</label>
        <div class="range-input">
          <input
            type="range"
            v-model.number="lineHeightValue"
            min="0.8" max="3" step="0.1"
            @input="handleLineHeightChange"
          />
          <span class="value">{{ lineHeightValue }}</span>
        </div>
      </div>
    </div>

    <!-- 关键帧控制 -->
    <KeyframeControls
      :keyframe-button-state="unifiedKeyframeButtonState"
      :can-operate-keyframes="canOperateUnifiedKeyframes"
      :has-previous-keyframe="hasUnifiedPreviousKeyframe"
      :has-next-keyframe="hasUnifiedNextKeyframe"
      :keyframe-tooltip="getUnifiedKeyframeTooltip()"
      :show-debug-button="false"
      @toggle-keyframe="toggleUnifiedKeyframe"
      @go-to-previous="goToPreviousUnifiedKeyframe"
      @go-to-next="goToNextUnifiedKeyframe"
      @debug-keyframes="debugUnifiedKeyframes"
    />

    <!-- 变换控制 -->
    <TransformControls
      :transform-x="transformX"
      :transform-y="transformY"
      :scale-x="scaleX"
      :scale-y="scaleY"
      :rotation="rotation"
      :opacity="opacity"
      :z-index="zIndex"
      :proportional-scale="proportionalScale"
      :uniform-scale="uniformScale"
      :position-limits="{
        minX: -videoStore.videoResolution.width,
        maxX: videoStore.videoResolution.width,
        minY: -videoStore.videoResolution.height,
        maxY: videoStore.videoResolution.height,
      }"
      @update-transform="updateTransform"
      @toggle-proportional-scale="toggleProportionalScale"
      @update-uniform-scale="updateUniformScale"
      @set-scale-x="setScaleX"
      @set-scale-y="setScaleY"
      @set-rotation="setRotation"
      @set-opacity="setOpacity"
      @align-horizontal="alignHorizontal"
      @align-vertical="alignVertical"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { useKeyframeTransformControls } from '../composables/useKeyframeTransformControls'
import type { TextMediaConfig, TextTimelineItem } from '../types'
import KeyframeControls from './KeyframeControls.vue'
import TransformControls from './TransformControls.vue'

interface Props {
  config: TextMediaConfig
  timelineItem: TextTimelineItem
}

interface Emits {
  (e: 'update:config', config: TextMediaConfig): void
  (e: 'update:text', text: string, style: any, originalText?: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const videoStore = useVideoStore()

// 关键帧动画和变换控制器
const {
  // 关键帧状态
  unifiedKeyframeButtonState,
  canOperateUnifiedKeyframes,
  hasUnifiedPreviousKeyframe,
  hasUnifiedNextKeyframe,

  // 变换属性
  transformX,
  transformY,
  scaleX,
  scaleY,
  rotation,
  opacity,
  zIndex,
  proportionalScale,
  uniformScale,

  // 关键帧控制方法
  toggleUnifiedKeyframe,
  goToPreviousUnifiedKeyframe,
  goToNextUnifiedKeyframe,
  getUnifiedKeyframeTooltip,
  debugUnifiedKeyframes,

  // 变换更新方法
  updateTransform,

  // 缩放控制方法
  toggleProportionalScale,
  updateUniformScale,
  setScaleX,
  setScaleY,

  // 旋转和透明度控制方法
  setRotation,
  setOpacity,

  // 对齐控制方法
  alignHorizontal,
  alignVertical,
} = useKeyframeTransformControls({
  selectedTimelineItem: computed(() => props.timelineItem),
  currentFrame: computed(() => videoStore.currentFrame),
})

// 本地配置状态
const localConfig = ref<TextMediaConfig>({ ...props.config })

// 本地文本内容状态（用于延迟更新）
const localTextContent = ref<string>(props.config.text)

// 对齐方式标签
const alignLabels = {
  left: '左对齐',
  center: '居中',
  right: '右对齐'
}

// 背景颜色开关
const hasBackground = computed({
  get: () => !!localConfig.value.style.backgroundColor,
  set: (value: boolean) => {
    if (!value) {
      localConfig.value.style.backgroundColor = undefined
    } else {
      localConfig.value.style.backgroundColor = '#000000'
    }
  }
})

// 背景颜色值
const backgroundColorValue = computed({
  get: () => localConfig.value.style.backgroundColor || '#000000',
  set: (value: string) => {
    if (hasBackground.value) {
      localConfig.value.style.backgroundColor = value
    }
  }
})

// 行高值
const lineHeightValue = computed({
  get: () => localConfig.value.style.lineHeight || 1.2,
  set: (value: number) => {
    localConfig.value.style.lineHeight = value
  }
})



// 监听外部配置变化
watch(() => props.config, (newConfig) => {
  localConfig.value = { ...newConfig }
  localTextContent.value = newConfig.text
}, { deep: true })

// 事件处理函数
function handleTextConfirm() {
  // 只有当文本内容真正改变时才更新
  if (localTextContent.value !== localConfig.value.text) {
    console.log('🔄 [TextProperties] 文本内容发生变化，准备更新:', {
      oldText: localConfig.value.text,
      newText: localTextContent.value
    })

    // 保存原始文本，用于命令系统比较
    const originalText = localConfig.value.text

    // 更新本地配置
    localConfig.value.text = localTextContent.value

    // 先发送文本更新事件（使用原始文本进行比较）
    emit('update:text', localTextContent.value, localConfig.value.style, originalText)

    // 再发送配置更新事件（用于实时预览）
    emit('update:config', { ...localConfig.value })

    console.log('📤 [TextProperties] 已发送更新事件')
  } else {
    console.log('⏭️ [TextProperties] 文本内容未变化，跳过更新')
  }
}

function handleStyleChange() {
  emit('update:config', { ...localConfig.value })
  emit('update:text', localConfig.value.text, localConfig.value.style)
}



function handleBackgroundColorChange() {
  if (hasBackground.value) {
    handleStyleChange()
  }
}

function handleLineHeightChange() {
  handleStyleChange()
}

function setTextAlign(align: 'left' | 'center' | 'right') {
  localConfig.value.style.textAlign = align
  handleStyleChange()
}

function toggleBackground() {
  handleStyleChange()
}
</script>

<style scoped>
.text-properties {
  padding: 16px;
}

.property-section {
  border-bottom: 1px solid var(--color-border-secondary);
  padding-bottom: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.section-title {
  margin: 0 0 var(--spacing-sm) 0;
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  font-weight: 600;
}

.property-group {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.property-group label {
  font-size: var(--font-size-base);
  color: var(--color-text-tertiary);
  flex-shrink: 0;
  min-width: 60px;
}

.text-input {
  background: var(--color-bg-quaternary);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--border-radius-small);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  padding: var(--spacing-xs) var(--spacing-sm);
  flex: 1;
  min-width: 0;
  resize: vertical;
  font-family: inherit;
  transition: border-color var(--transition-fast);
}

.text-input:focus {
  outline: none;
  border-color: var(--color-border-focus);
}

select {
  background: var(--color-bg-quaternary);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--border-radius-small);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  padding: var(--spacing-xs) var(--spacing-sm);
  flex: 1;
  min-width: 0;
  transition: border-color var(--transition-fast);
}

select:focus {
  outline: none;
  border-color: var(--color-border-focus);
}

.range-input {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex: 1;
}

.range-input input[type="range"] {
  flex: 1;
}

.value {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  min-width: 50px;
  text-align: right;
}

.color-input {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex: 1;
}

.color-input input[type="color"] {
  width: 40px;
  height: 30px;
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--border-radius-small);
  cursor: pointer;
}

.color-value {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  font-family: monospace;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  cursor: pointer;
}

.align-buttons {
  display: flex;
  gap: var(--spacing-xs);
  flex: 1;
}

.align-buttons button {
  flex: 1;
  background: var(--color-bg-active);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--border-radius-medium);
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: var(--spacing-xs) var(--spacing-md);
  font-size: var(--font-size-base);
  transition: all var(--transition-fast);
}

.align-buttons button:hover {
  background: var(--color-border-secondary);
  color: var(--color-text-primary);
  border-color: var(--color-border-hover);
}

.align-buttons button.active {
  background: var(--color-accent-secondary);
  color: var(--color-text-primary);
  border-color: var(--color-accent-secondary);
}



/* 注意：深色主题样式已通过CSS变量系统自动处理，无需额外的媒体查询 */
</style>
