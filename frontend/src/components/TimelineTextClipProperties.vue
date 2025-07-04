<template>
  <div class="timeline-text-clip-properties">
    <!-- 基本信息 -->
    <div class="property-section">
      <h4>基本信息</h4>
      <div class="property-item">
        <label>文本内容</label>
        <textarea
          v-model="localText"
          @blur="updateTextContent"
          @keyup.ctrl.enter="updateTextContent"
          class="text-content-input"
          placeholder="输入文本内容..."
          rows="3"
        />
      </div>
      <div class="property-item">
        <label>显示时长</label>
        <div class="duration-controls">
          <input
            type="text"
            v-model="timecodeInput"
            @blur="updateTargetDurationFromTimecode"
            @keyup.enter="updateTargetDurationFromTimecode"
            placeholder="HH:MM:SS.FF"
            class="timecode-input"
          />
        </div>
      </div>
    </div>

    <!-- 文本样式 -->
    <div class="property-section">
      <h4>文本样式</h4>

      <!-- 字体设置 -->
      <div class="property-item">
        <label>字体</label>
        <div class="font-controls">
          <select
            v-model="localStyle.fontFamily"
            @change="updateTextStyle"
            class="font-family-select"
          >
            <option value="Arial, sans-serif">Arial</option>
            <option value="'Microsoft YaHei', sans-serif">微软雅黑</option>
            <option value="'SimHei', sans-serif">黑体</option>
            <option value="'SimSun', serif">宋体</option>
            <option value="'KaiTi', serif">楷体</option>
            <option value="'Times New Roman', serif">Times New Roman</option>
            <option value="'Courier New', monospace">Courier New</option>
          </select>
        </div>
      </div>

      <!-- 字体大小 -->
      <div class="property-item">
        <label>字体大小</label>
        <div class="font-size-controls">
          <SliderInput
            :model-value="localStyle.fontSize"
            @input="updateFontSize"
            :min="12"
            :max="200"
            :step="1"
            slider-class="font-size-slider"
          />
          <NumberInput
            :model-value="localStyle.fontSize"
            @change="updateFontSize"
            :min="12"
            :max="200"
            :step="1"
            :precision="0"
            :show-controls="false"
            placeholder="字号"
            :input-style="numberInputStyle"
          />
        </div>
      </div>

      <!-- 字体样式 -->
      <div class="property-item">
        <label>字体样式</label>
        <div class="font-style-controls">
          <select
            v-model="localStyle.fontWeight"
            @change="updateTextStyle"
            class="font-weight-select"
          >
            <option value="normal">正常</option>
            <option value="bold">粗体</option>
            <option value="lighter">细体</option>
          </select>
          <select
            v-model="localStyle.fontStyle"
            @change="updateTextStyle"
            class="font-style-select"
          >
            <option value="normal">正常</option>
            <option value="italic">斜体</option>
          </select>
        </div>
      </div>

      <!-- 文字颜色 -->
      <div class="property-item">
        <label>文字颜色</label>
        <div class="color-controls">
          <input
            type="color"
            v-model="localStyle.color"
            @change="updateTextStyle"
            class="color-picker"
          />
        </div>
      </div>

      <!-- 背景颜色 -->
      <div class="property-item">
        <label>背景颜色</label>
        <div class="background-color-controls">
          <input
            type="color"
            :value="localStyle.backgroundColor || '#000000'"
            @input="
              (e) => {
                localStyle.backgroundColor = (e.target as HTMLInputElement).value
              }
            "
            @change="updateTextStyle"
            class="color-picker"
            :disabled="!backgroundColorEnabled"
          />
          <label class="checkbox-wrapper">
            <input
              type="checkbox"
              v-model="backgroundColorEnabled"
              @change="toggleBackgroundColor"
              class="background-color-checkbox"
            />
          </label>
        </div>
      </div>

      <!-- 文本对齐 -->
      <div class="property-item">
        <label>文本对齐</label>
        <div class="text-align-controls">
          <button
            v-for="align in textAlignOptions"
            :key="align.value"
            @click="updateTextAlign(align.value)"
            class="align-btn"
            :class="{ active: localStyle.textAlign === align.value }"
            :title="align.label"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path :d="align.icon" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 文本效果 -->
    <div class="property-section">
      <h4>文本效果</h4>

      <!-- 阴影效果 -->
      <div class="property-item">
        <label>阴影</label>
        <div class="shadow-controls">
          <label class="checkbox-wrapper">
            <input
              type="checkbox"
              v-model="shadowEnabled"
              @change="toggleShadow"
              class="effect-checkbox"
            />
          </label>
          <div v-if="shadowEnabled" class="shadow-settings">
            <div class="shadow-setting-row">
              <label class="setting-label">颜色</label>
              <input
                type="color"
                v-model="shadowColor"
                @change="updateShadowEffect"
                class="color-picker small"
              />
            </div>
            <div class="shadow-setting-row">
              <label class="setting-label">模糊</label>
              <SliderInput
                :model-value="shadowBlur"
                @input="updateShadowBlur"
                :min="0"
                :max="20"
                :step="1"
                slider-class="effect-slider"
              />
              <NumberInput
                :model-value="shadowBlur"
                @change="updateShadowBlur"
                :min="0"
                :max="20"
                :step="1"
                :precision="0"
                :show-controls="false"
                placeholder="模糊"
                :input-style="smallNumberInputStyle"
              />
            </div>
            <div class="shadow-setting-row">
              <label class="setting-label">偏移X</label>
              <SliderInput
                :model-value="shadowOffsetX"
                @input="updateShadowOffsetX"
                :min="-20"
                :max="20"
                :step="1"
                slider-class="effect-slider"
              />
              <NumberInput
                :model-value="shadowOffsetX"
                @change="updateShadowOffsetX"
                :min="-20"
                :max="20"
                :step="1"
                :precision="0"
                :show-controls="false"
                placeholder="X"
                :input-style="smallNumberInputStyle"
              />
            </div>
            <div class="shadow-setting-row">
              <label class="setting-label">偏移Y</label>
              <SliderInput
                :model-value="shadowOffsetY"
                @input="updateShadowOffsetY"
                :min="-20"
                :max="20"
                :step="1"
                slider-class="effect-slider"
              />
              <NumberInput
                :model-value="shadowOffsetY"
                @change="updateShadowOffsetY"
                :min="-20"
                :max="20"
                :step="1"
                :precision="0"
                :show-controls="false"
                placeholder="Y"
                :input-style="smallNumberInputStyle"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 描边效果 -->
      <div class="property-item">
        <label>描边</label>
        <div class="stroke-controls">
          <label class="checkbox-wrapper">
            <input
              type="checkbox"
              v-model="strokeEnabled"
              @change="toggleStroke"
              class="effect-checkbox"
            />
          </label>
          <div v-if="strokeEnabled" class="stroke-settings">
            <div class="stroke-setting-row">
              <label class="setting-label">颜色</label>
              <input
                type="color"
                v-model="strokeColor"
                @change="updateStrokeEffect"
                class="color-picker small"
              />
            </div>
            <div class="stroke-setting-row">
              <label class="setting-label">宽度</label>
              <SliderInput
                :model-value="strokeWidth"
                @input="updateStrokeWidth"
                :min="0"
                :max="10"
                :step="0.5"
                slider-class="effect-slider"
              />
              <NumberInput
                :model-value="strokeWidth"
                @change="updateStrokeWidth"
                :min="0"
                :max="10"
                :step="0.5"
                :precision="1"
                :show-controls="false"
                placeholder="宽度"
                :input-style="smallNumberInputStyle"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 发光效果 -->
      <div class="property-item">
        <label>发光</label>
        <div class="glow-controls">
          <label class="checkbox-wrapper">
            <input
              type="checkbox"
              v-model="glowEnabled"
              @change="toggleGlow"
              class="effect-checkbox"
            />
          </label>
          <div v-if="glowEnabled" class="glow-settings">
            <div class="glow-setting-row">
              <label class="setting-label">颜色</label>
              <input
                type="color"
                v-model="glowColor"
                @change="updateGlowEffect"
                class="color-picker small"
              />
            </div>
            <div class="glow-setting-row">
              <label class="setting-label">模糊</label>
              <SliderInput
                :model-value="glowBlur"
                @input="updateGlowBlur"
                :min="1"
                :max="30"
                :step="1"
                slider-class="effect-slider"
              />
              <NumberInput
                :model-value="glowBlur"
                @change="updateGlowBlur"
                :min="1"
                :max="30"
                :step="1"
                :precision="0"
                :show-controls="false"
                placeholder="模糊"
                :input-style="smallNumberInputStyle"
              />
            </div>
            <div class="glow-setting-row">
              <label class="setting-label">扩散</label>
              <SliderInput
                :model-value="glowSpread"
                @input="updateGlowSpread"
                :min="0"
                :max="20"
                :step="1"
                slider-class="effect-slider"
              />
              <NumberInput
                :model-value="glowSpread"
                @change="updateGlowSpread"
                :min="0"
                :max="20"
                :step="1"
                :precision="0"
                :show-controls="false"
                placeholder="扩散"
                :input-style="smallNumberInputStyle"
              />
            </div>
          </div>
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
import { framesToTimecode, timecodeToFrames } from '../stores/utils/timeUtils'
import { useKeyframeTransformControls } from '../composables/useKeyframeTransformControls'
import NumberInput from './NumberInput.vue'
import SliderInput from './SliderInput.vue'
import KeyframeControls from './KeyframeControls.vue'
import TransformControls from './TransformControls.vue'
import type { TimelineItem, TextStyleConfig } from '../types'

interface Props {
  selectedTimelineItem: TimelineItem<'text'> | null
  currentFrame: number
}

const props = defineProps<Props>()
const videoStore = useVideoStore()

// 本地状态管理
const localText = ref('')
const localStyle = ref<TextStyleConfig>({
  fontSize: 48,
  fontFamily: 'Arial, sans-serif',
  fontWeight: 'normal',
  fontStyle: 'normal',
  color: '#ffffff',
  textAlign: 'center',
  lineHeight: 1.2,
  backgroundColor: '#000000', // 默认背景颜色
})

// 背景颜色启用状态
const backgroundColorEnabled = ref(false)

// 文本效果状态
const shadowEnabled = ref(false)
const shadowColor = ref('#000000')
const shadowBlur = ref(4)
const shadowOffsetX = ref(2)
const shadowOffsetY = ref(2)

const strokeEnabled = ref(false)
const strokeColor = ref('#000000')
const strokeWidth = ref(1)

const glowEnabled = ref(false)
const glowColor = ref('#ffffff')
const glowBlur = ref(10)
const glowSpread = ref(0)

// 文本对齐选项
const textAlignOptions = [
  {
    value: 'left' as const,
    label: '左对齐',
    icon: 'M3,3H21V5H3V3M3,7H15V9H3V7M3,11H21V13H3V11M3,15H15V17H3V15M3,19H21V21H3V19Z',
  },
  {
    value: 'center' as const,
    label: '居中对齐',
    icon: 'M3,3H21V5H3V3M7,7H17V9H7V7M3,11H21V13H3V11M7,15H17V17H7V15M3,19H21V21H3V19Z',
  },
  {
    value: 'right' as const,
    label: '右对齐',
    icon: 'M3,3H21V5H3V3M9,7H21V9H9V7M3,11H21V13H3V11M9,15H21V17H9V15M3,19H21V21H3V19Z',
  },
]

// 样式定义
const numberInputStyle = {
  maxWidth: '60px',
  textAlign: 'center' as const,
}

const smallNumberInputStyle = {
  maxWidth: '50px',
  textAlign: 'center' as const,
}

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
  selectedTimelineItem: computed(() => props.selectedTimelineItem),
  currentFrame: computed(() => props.currentFrame),
})

// 时间轴时长（帧数）
const timelineDurationFrames = computed(() => {
  if (!props.selectedTimelineItem) return 0
  const timeRange = props.selectedTimelineItem.timeRange
  return Math.round(timeRange.timelineEndTime - timeRange.timelineStartTime)
})

// 格式化时长显示（使用时间码格式）
const formattedDuration = computed(() => {
  return framesToTimecode(timelineDurationFrames.value)
})

// 时间码输入框的临时值
const timecodeInput = computed({
  get: () => formattedDuration.value,
  set: () => {
    // 这里不做任何操作，只在失焦或回车时更新
  },
})

// 监听选中项目变化，同步本地状态
watch(
  () => props.selectedTimelineItem,
  (newItem) => {
    if (newItem && newItem.mediaType === 'text') {
      localText.value = newItem.config.text
      localStyle.value = { ...newItem.config.style }

      // 确保 backgroundColor 有一个有效的默认值，避免空字符串导致的颜色输入框警告
      if (!localStyle.value.backgroundColor) {
        localStyle.value.backgroundColor = '#000000'
      }

      // 同步背景颜色启用状态
      backgroundColorEnabled.value = !!newItem.config.style.backgroundColor

      // 同步文本效果状态
      if (newItem.config.style.textShadow) {
        shadowEnabled.value = true
        // 解析阴影字符串 (简单解析，格式: "2px 2px 4px #000000")
        const shadowMatch = newItem.config.style.textShadow.match(
          /(-?\d+)px\s+(-?\d+)px\s+(\d+)px\s+(#[0-9a-fA-F]{6}|rgba?\([^)]+\)|[a-zA-Z]+)/,
        )
        if (shadowMatch) {
          shadowOffsetX.value = parseInt(shadowMatch[1])
          shadowOffsetY.value = parseInt(shadowMatch[2])
          shadowBlur.value = parseInt(shadowMatch[3])
          shadowColor.value = shadowMatch[4]
        }
      } else {
        shadowEnabled.value = false
      }

      if (newItem.config.style.textStroke) {
        strokeEnabled.value = true
        strokeWidth.value = newItem.config.style.textStroke.width
        strokeColor.value = newItem.config.style.textStroke.color
      } else {
        strokeEnabled.value = false
      }

      if (newItem.config.style.textGlow) {
        glowEnabled.value = true
        glowColor.value = newItem.config.style.textGlow.color
        glowBlur.value = newItem.config.style.textGlow.blur
        glowSpread.value = newItem.config.style.textGlow.spread || 0
      } else {
        glowEnabled.value = false
      }
    }
  },
  { immediate: true },
)

// 更新文本内容
const updateTextContent = async () => {
  if (!props.selectedTimelineItem || !localText.value.trim()) {
    return
  }

  try {
    console.log('🔄 [TimelineTextClipProperties] 更新文本内容:', localText.value.substring(0, 20) + '...')

    // 导入文本命令
    const { UpdateTextCommand } = await import('../stores/modules/commands/textCommands')

    // 创建更新命令
    const command = new UpdateTextCommand(
      props.selectedTimelineItem.id,
      localText.value.trim(),
      {},
      {
        getTimelineItem: videoStore.getTimelineItem,
      },
    )

    // 执行命令（带历史记录）
    await videoStore.executeCommand(command)

    console.log('✅ [TimelineTextClipProperties] 文本内容更新成功')
  } catch (error) {
    console.error('❌ [TimelineTextClipProperties] 更新文本内容失败:', error)
    videoStore.showError('更新失败', '文本内容更新失败，请重试')
  }
}

// 更新文本样式
const updateTextStyle = async () => {
  if (!props.selectedTimelineItem) {
    return
  }

  try {
    // 根据backgroundColorEnabled状态决定是否包含背景颜色
    const styleToUpdate = { ...localStyle.value }
    if (!backgroundColorEnabled.value) {
      // 如果背景颜色未启用，则明确设置为undefined以覆盖原有值
      styleToUpdate.backgroundColor = undefined
    }

    console.log('🎨 [TimelineTextClipProperties] 更新文本样式:', styleToUpdate)

    // 导入文本命令
    const { UpdateTextCommand } = await import('../stores/modules/commands/textCommands')

    // 创建更新命令
    const command = new UpdateTextCommand(
      props.selectedTimelineItem.id,
      props.selectedTimelineItem.config.text, // 保持文本内容不变
      styleToUpdate,
      {
        getTimelineItem: videoStore.getTimelineItem,
      },
    )

    // 执行命令（带历史记录）
    await videoStore.executeCommand(command)

    console.log('✅ [TimelineTextClipProperties] 文本样式更新成功')
  } catch (error) {
    console.error('❌ [TimelineTextClipProperties] 更新文本样式失败:', error)
    videoStore.showError('更新失败', '文本样式更新失败，请重试')
  }
}

// 更新字体大小
const updateFontSize = (newSize: number) => {
  localStyle.value.fontSize = Math.max(12, Math.min(200, newSize))
  updateTextStyle()
}

// 更新文本对齐
const updateTextAlign = (align: 'left' | 'center' | 'right') => {
  localStyle.value.textAlign = align
  updateTextStyle()
}

// 切换背景颜色启用状态
const toggleBackgroundColor = () => {
  // 无论启用还是禁用，都保持backgroundColor的值不变
  // 在updateTextStyle中根据backgroundColorEnabled状态决定是否应用背景颜色
  updateTextStyle()
}

// ==================== 文本效果方法 ====================

// 阴影效果方法
const toggleShadow = () => {
  updateShadowEffect()
}

const updateShadowEffect = () => {
  if (shadowEnabled.value) {
    localStyle.value.textShadow = `${shadowOffsetX.value}px ${shadowOffsetY.value}px ${shadowBlur.value}px ${shadowColor.value}`
  } else {
    localStyle.value.textShadow = undefined
  }
  updateTextStyle()
}

const updateShadowBlur = (newBlur: number) => {
  shadowBlur.value = Math.max(0, Math.min(20, newBlur))
  updateShadowEffect()
}

const updateShadowOffsetX = (newOffsetX: number) => {
  shadowOffsetX.value = Math.max(-20, Math.min(20, newOffsetX))
  updateShadowEffect()
}

const updateShadowOffsetY = (newOffsetY: number) => {
  shadowOffsetY.value = Math.max(-20, Math.min(20, newOffsetY))
  updateShadowEffect()
}

// 描边效果方法
const toggleStroke = () => {
  updateStrokeEffect()
}

const updateStrokeEffect = () => {
  if (strokeEnabled.value) {
    localStyle.value.textStroke = {
      width: strokeWidth.value,
      color: strokeColor.value,
    }
  } else {
    localStyle.value.textStroke = undefined
  }
  updateTextStyle()
}

const updateStrokeWidth = (newWidth: number) => {
  strokeWidth.value = Math.max(0, Math.min(10, newWidth))
  updateStrokeEffect()
}

// 发光效果方法
const toggleGlow = () => {
  updateGlowEffect()
}

const updateGlowEffect = () => {
  if (glowEnabled.value) {
    localStyle.value.textGlow = {
      color: glowColor.value,
      blur: glowBlur.value,
      spread: glowSpread.value,
    }
  } else {
    localStyle.value.textGlow = undefined
  }
  updateTextStyle()
}

const updateGlowBlur = (newBlur: number) => {
  glowBlur.value = Math.max(1, Math.min(30, newBlur))
  updateGlowEffect()
}

const updateGlowSpread = (newSpread: number) => {
  glowSpread.value = Math.max(0, Math.min(20, newSpread))
  updateGlowEffect()
}

// 更新目标时长（从时间码输入）
const updateTargetDurationFromTimecode = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const timecodeValue = input.value.trim()

  if (!timecodeValue || !props.selectedTimelineItem) {
    // 如果输入为空，恢复到当前值
    input.value = formattedDuration.value
    return
  }

  try {
    // 解析时间码为帧数
    const newDurationFrames = timecodeToFrames(timecodeValue)
    const alignedDurationFrames = Math.max(1, newDurationFrames) // 最少1帧

    // 更新时长
    await updateTargetDurationFrames(alignedDurationFrames)

    console.log('✅ [TimelineTextClipProperties] 时间码时长更新成功:', {
      inputTimecode: timecodeValue,
      parsedFrames: newDurationFrames,
      alignedFrames: alignedDurationFrames,
      finalTimecode: framesToTimecode(alignedDurationFrames),
    })
  } catch (error) {
    console.warn('⚠️ [TimelineTextClipProperties] 时间码格式无效:', timecodeValue, error)

    // 显示错误通知
    videoStore.showError(
      '时间码格式错误',
      '请使用正确的时间码格式：HH:MM:SS.FF\n示例：00:01:30.15（1分30秒15帧）',
      8000,
    )

    // 恢复到当前值
    input.value = formattedDuration.value
  }
}

// 更新目标时长（帧数版本）
const updateTargetDurationFrames = async (newDurationFrames: number) => {
  if (!props.selectedTimelineItem) {
    return
  }

  const alignedDurationFrames = Math.max(1, newDurationFrames) // 最少1帧
  const sprite = props.selectedTimelineItem.sprite
  const timeRange = props.selectedTimelineItem.timeRange
  const oldDurationFrames = timeRange.timelineEndTime - timeRange.timelineStartTime
  const newTimelineEndTime = timeRange.timelineStartTime + alignedDurationFrames

  // 调整关键帧位置（如果有动画）
  if (
    props.selectedTimelineItem.animation &&
    props.selectedTimelineItem.animation.keyframes.length > 0
  ) {
    const { adjustKeyframesForDurationChange } = await import('../utils/unifiedKeyframeUtils')
    adjustKeyframesForDurationChange(
      props.selectedTimelineItem,
      oldDurationFrames,
      alignedDurationFrames,
    )
    console.log('🎬 [TimelineTextClipProperties] 关键帧已调整适应新时长')
  }

  // 更新sprite时间范围（文本使用ImageTimeRange）
  sprite.setTimeRange({
    timelineStartTime: timeRange.timelineStartTime,
    timelineEndTime: newTimelineEndTime,
  })

  // 更新timelineItem的timeRange（文本项目使用ImageTimeRange）
  const newTimeRange = sprite.getTimeRange()
  if ('displayDuration' in newTimeRange) {
    // 如果是ImageTimeRange，直接赋值
    props.selectedTimelineItem.timeRange = newTimeRange
  } else {
    // 如果是VideoTimeRange，转换为ImageTimeRange
    props.selectedTimelineItem.timeRange = {
      timelineStartTime: newTimeRange.timelineStartTime,
      timelineEndTime: newTimeRange.timelineEndTime,
      displayDuration: newTimeRange.timelineEndTime - newTimeRange.timelineStartTime,
    }
  }

  // 如果有动画，需要重新设置WebAV动画时长
  if (props.selectedTimelineItem.animation && props.selectedTimelineItem.animation.isEnabled) {
    const { updateWebAVAnimation } = await import('../utils/webavAnimationManager')
    await updateWebAVAnimation(props.selectedTimelineItem)
    console.log('🎬 [TimelineTextClipProperties] 动画时长已更新')
  }

  console.log('✅ [TimelineTextClipProperties] 帧数时长更新成功:', {
    inputFrames: newDurationFrames,
    alignedFrames: alignedDurationFrames,
    timecode: framesToTimecode(alignedDurationFrames),
  })
}
</script>

<style scoped>
.timeline-text-clip-properties {
  width: 100%;
}

/* 文本内容输入框 */
.text-content-input {
  width: 100%;
  min-height: 60px;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--border-radius-small);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.4;
  resize: vertical;
  transition: border-color 0.2s ease;
}

.text-content-input:focus {
  outline: none;
  border-color: var(--color-border-focus);
  background: var(--color-bg-primary);
}

.text-content-input::placeholder {
  color: var(--color-text-hint);
  font-style: italic;
}

/* 时长控制样式 */
.duration-controls {
  display: flex;
  align-items: center;
  flex: 1;
}

.timecode-input {
  width: 100%;
  max-width: 120px;
  text-align: center;
}

.timecode-input::placeholder {
  color: var(--color-text-hint);
  font-style: italic;
}

/* 字体控制样式 */
.font-controls {
  display: flex;
  align-items: center;
  flex: 1;
}

.font-family-select {
  width: 100%;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--border-radius-small);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.font-family-select:focus {
  outline: none;
  border-color: var(--color-border-focus);
}

/* 字体大小控制 */
.font-size-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex: 1;
}

/* 字体样式控制 */
.font-style-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex: 1;
}

.font-weight-select,
.font-style-select {
  flex: 1;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--border-radius-small);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.font-weight-select:focus,
.font-style-select:focus {
  outline: none;
  border-color: var(--color-border-focus);
}

/* 颜色控制样式 */
.color-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex: 1;
}

.color-picker {
  width: 40px;
  height: 32px;
  border: 1px solid transparent;
  border-radius: var(--border-radius-small);
  cursor: pointer;
  background: transparent;
  transition: border-color 0.2s ease;
}

.color-picker:focus {
  outline: none;
  border-color: var(--color-border-focus);
}

/* 背景颜色控制样式 */
.background-color-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex: 1;
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  cursor: pointer;
}

.background-color-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.checkbox-label {
  font-size: 14px;
  color: var(--color-text-primary);
  cursor: pointer;
  user-select: none;
}

.color-picker:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 文本对齐控制 */
.text-align-controls {
  display: flex;
  gap: var(--spacing-xs);
}

.align-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--border-radius-small);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.align-btn:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border-focus);
  color: var(--color-text-primary);
}

.align-btn.active {
  background: var(--color-accent-primary);
  border-color: var(--color-accent-primary);
  color: var(--color-bg-primary);
}

.align-btn.active:hover {
  background: var(--color-accent-secondary);
  border-color: var(--color-accent-secondary);
}

/* 文本效果样式 */
.shadow-controls,
.stroke-controls,
.glow-controls {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  flex: 1;
}

.shadow-settings,
.stroke-settings,
.glow-settings {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  background: var(--color-bg-tertiary);
  border-radius: var(--border-radius-small);
  border: 1px solid var(--color-border-secondary);
}

.shadow-setting-row,
.stroke-setting-row,
.glow-setting-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.setting-label {
  min-width: 40px;
  font-size: 12px;
  color: var(--color-text-secondary);
  text-align: right;
}

.effect-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.color-picker.small {
  width: 32px;
  height: 24px;
}

.effect-slider {
  flex: 1;
  min-width: 80px;
}
</style>
