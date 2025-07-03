# TextVisibleSprite 集成指南

## 概述

本文档说明如何将 `TextVisibleSprite` 集成到现有的视频编辑器系统中。

## 快速开始

### 1. 基础使用

```typescript
import { TextVisibleSprite } from '../utils/TextVisibleSprite'

// 创建文本精灵
const textSprite = await TextVisibleSprite.create('Hello World!', {
  fontSize: 48,
  color: '#ffffff',
  textAlign: 'center'
})

// 设置位置和时间
textSprite.rect.x = 100
textSprite.rect.y = 100
textSprite.setTimelineStartTime(0)
textSprite.setDisplayDuration(150) // 5秒

// 添加到画布
avCanvas.addSprite(textSprite)
```

### 2. 动态更新

```typescript
// 更新文本内容
await textSprite.updateText('新的文本内容')

// 更新样式
await textSprite.updateStyle({
  fontSize: 64,
  color: 'red'
})

// 更新文本效果
await textSprite.updateStyle({
  fontSize: 48,
  color: '#ffffff',
  textShadow: '2px 2px 4px #000000',  // 阴影效果
  textStroke: {                       // 描边效果
    width: 2,
    color: '#000000'
  },
  textGlow: {                         // 发光效果
    color: '#00ff00',
    blur: 10,
    spread: 5
  }
})

// 同时更新文本和样式
await textSprite.updateTextAndStyle('最终文本', {
  fontSize: 72,
  color: 'blue'
})
```

## 文本效果功能

### 支持的文本效果

#### 1. 阴影效果 (textShadow)
```typescript
// 基础阴影
const shadowStyle = {
  textShadow: '2px 2px 4px #000000'  // 偏移X 偏移Y 模糊度 颜色
}

// 多重阴影
const multiShadowStyle = {
  textShadow: '2px 2px 4px #000000, -2px -2px 4px #ffffff'
}
```

#### 2. 描边效果 (textStroke)
```typescript
const strokeStyle = {
  textStroke: {
    width: 2,        // 描边宽度 (0-10px)
    color: '#000000' // 描边颜色
  }
}
```

#### 3. 发光效果 (textGlow)
```typescript
const glowStyle = {
  textGlow: {
    color: '#00ff00',  // 发光颜色
    blur: 10,          // 模糊度 (1-30px)
    spread: 5          // 扩散范围 (0-20px，可选)
  }
}
```

#### 4. 组合效果
```typescript
// 同时使用多种效果
const combinedStyle = {
  fontSize: 48,
  color: '#ffffff',
  textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
  textStroke: {
    width: 1,
    color: '#000000'
  },
  textGlow: {
    color: '#ffff00',
    blur: 15,
    spread: 8
  }
}

await textSprite.updateStyle(combinedStyle)
```

### 效果实现原理

#### CSS 渲染机制
文本效果通过 WebAV 的 `renderTxt2ImgBitmap` 函数实现，该函数支持完整的 CSS 样式：

```typescript
// TextHelper.generateCSSFromStyle 生成的 CSS
const cssText = `
  font-size: 48px;
  color: #ffffff;
  text-shadow: 2px 2px 4px #000000, 0 0 10px #ffff00, 0 0 20px #ffff00, 0 0 30px #ffff00;
  -webkit-text-stroke: 1px #000000;
`
```

#### 发光效果实现
发光效果通过多重 `text-shadow` 实现：
```typescript
// 生成发光阴影
const glowShadows = [
  `0 0 ${blur}px ${color}`,      // 内层发光
  `0 0 ${blur * 2}px ${color}`,  // 中层发光
  `0 0 ${blur * 3}px ${color}`   // 外层发光
]
if (spread > 0) {
  glowShadows.push(`0 0 ${spread}px ${color}`)  // 扩散层
}
```

## 系统集成

### 1. 媒体库集成

在 `MediaLibrary.vue` 中添加文本创建功能：

```typescript
// 添加创建文本素材的方法
const createTextMediaItem = async (text: string, style?: Partial<TextStyleConfig>) => {
  const textSprite = await TextVisibleSprite.create(text, style)
  
  // 创建对应的 MediaItem
  const mediaItem: MediaItem = {
    id: generateId(),
    name: `文本-${text.substring(0, 10)}`,
    file: null, // 文本不需要文件
    url: '',
    duration: TextVisibleSprite.DEFAULT_DURATION,
    type: 'text',
    mediaType: 'text', // 需要扩展 MediaType
    mp4Clip: null,
    imgClip: null,
    textSprite: markRaw(textSprite), // 新增字段
    isReady: true,
    status: 'ready'
  }
  
  videoStore.addMediaItem(mediaItem)
}
```

### 2. 时间轴集成

在 `Timeline.vue` 中处理文本片段：

```typescript
// 处理文本精灵的拖拽到时间轴
const handleTextDrop = async (mediaItem: MediaItem, trackId: string, startTime: number) => {
  if (mediaItem.textSprite) {
    // 克隆文本精灵
    const newTextSprite = await mediaItem.textSprite.createUpdatedSprite()
    
    // 设置时间轴位置
    newTextSprite.setTimelineStartTime(startTime)
    
    // 创建时间轴项目
    const timelineItem: TimelineItem = {
      id: generateId(),
      mediaItemId: mediaItem.id,
      trackId: trackId,
      timeRange: newTextSprite.getTimeRange(),
      sprite: markRaw(newTextSprite)
    }
    
    // 添加到时间轴
    videoStore.addTimelineItem(timelineItem)
    
    // 添加到画布
    avCanvas.addSprite(newTextSprite)
  }
}
```

### 3. 属性面板集成

创建 `TextClipProperties.vue` 组件，包含完整的文本效果控制：

```vue
<template>
  <div class="text-clip-properties">
    <!-- 基本信息 -->
    <div class="property-section">
      <h4>基本信息</h4>
      <div class="property-item">
        <label>文本内容</label>
        <textarea
          v-model="localText"
          @blur="updateTextContent"
          placeholder="输入文本内容..."
        />
      </div>
    </div>

    <!-- 文本样式 -->
    <div class="property-section">
      <h4>文本样式</h4>

      <div class="property-item">
        <label>字体大小</label>
        <SliderInput
          :model-value="localStyle.fontSize"
          @input="updateFontSize"
          :min="12"
          :max="200"
        />
      </div>

      <div class="property-item">
        <label>文字颜色</label>
        <input
          type="color"
          v-model="localStyle.color"
          @change="updateTextStyle"
        />
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
            <input type="checkbox" v-model="shadowEnabled" @change="toggleShadow" />
            <span>启用</span>
          </label>
          <div v-if="shadowEnabled" class="shadow-settings">
            <div class="shadow-setting-row">
              <label>颜色</label>
              <input type="color" v-model="shadowColor" @change="updateShadowEffect" />
            </div>
            <div class="shadow-setting-row">
              <label>模糊</label>
              <SliderInput :model-value="shadowBlur" @input="updateShadowBlur" :min="0" :max="20" />
            </div>
            <div class="shadow-setting-row">
              <label>偏移X</label>
              <SliderInput :model-value="shadowOffsetX" @input="updateShadowOffsetX" :min="-20" :max="20" />
            </div>
            <div class="shadow-setting-row">
              <label>偏移Y</label>
              <SliderInput :model-value="shadowOffsetY" @input="updateShadowOffsetY" :min="-20" :max="20" />
            </div>
          </div>
        </div>
      </div>

      <!-- 描边效果 -->
      <div class="property-item">
        <label>描边</label>
        <div class="stroke-controls">
          <label class="checkbox-wrapper">
            <input type="checkbox" v-model="strokeEnabled" @change="toggleStroke" />
            <span>启用</span>
          </label>
          <div v-if="strokeEnabled" class="stroke-settings">
            <div class="stroke-setting-row">
              <label>颜色</label>
              <input type="color" v-model="strokeColor" @change="updateStrokeEffect" />
            </div>
            <div class="stroke-setting-row">
              <label>宽度</label>
              <SliderInput :model-value="strokeWidth" @input="updateStrokeWidth" :min="0" :max="10" :step="0.5" />
            </div>
          </div>
        </div>
      </div>

      <!-- 发光效果 -->
      <div class="property-item">
        <label>发光</label>
        <div class="glow-controls">
          <label class="checkbox-wrapper">
            <input type="checkbox" v-model="glowEnabled" @change="toggleGlow" />
            <span>启用</span>
          </label>
          <div v-if="glowEnabled" class="glow-settings">
            <div class="glow-setting-row">
              <label>颜色</label>
              <input type="color" v-model="glowColor" @change="updateGlowEffect" />
            </div>
            <div class="glow-setting-row">
              <label>模糊</label>
              <SliderInput :model-value="glowBlur" @input="updateGlowBlur" :min="1" :max="30" />
            </div>
            <div class="glow-setting-row">
              <label>扩散</label>
              <SliderInput :model-value="glowSpread" @input="updateGlowSpread" :min="0" :max="20" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import SliderInput from './SliderInput.vue'
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
})

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

// 监听选中项目变化，同步本地状态
watch(
  () => props.selectedTimelineItem,
  (newItem) => {
    if (newItem && newItem.mediaType === 'text') {
      localText.value = newItem.config.text
      localStyle.value = { ...newItem.config.style }

      // 同步文本效果状态
      if (newItem.config.style.textShadow) {
        shadowEnabled.value = true
        // 解析阴影字符串
        const shadowMatch = newItem.config.style.textShadow.match(/(-?\d+)px\s+(-?\d+)px\s+(\d+)px\s+(#[0-9a-fA-F]{6}|rgba?\([^)]+\)|[a-zA-Z]+)/)
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
  { immediate: true }
)

// 文本效果方法
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

const toggleStroke = () => {
  updateStrokeEffect()
}

const updateStrokeEffect = () => {
  if (strokeEnabled.value) {
    localStyle.value.textStroke = {
      width: strokeWidth.value,
      color: strokeColor.value
    }
  } else {
    localStyle.value.textStroke = undefined
  }
  updateTextStyle()
}

const toggleGlow = () => {
  updateGlowEffect()
}

const updateGlowEffect = () => {
  if (glowEnabled.value) {
    localStyle.value.textGlow = {
      color: glowColor.value,
      blur: glowBlur.value,
      spread: glowSpread.value
    }
  } else {
    localStyle.value.textGlow = undefined
  }
  updateTextStyle()
}

// 更新文本样式的核心方法
const updateTextStyle = async () => {
  if (!props.selectedTimelineItem) return

  try {
    const { UpdateTextCommand } = await import('../stores/modules/commands/textCommands')
    const command = new UpdateTextCommand(
      props.selectedTimelineItem.id,
      props.selectedTimelineItem.config.text,
      localStyle.value,
      { getTimelineItem: videoStore.getTimelineItem }
    )
    await videoStore.executeCommand(command)
  } catch (error) {
    console.error('更新文本样式失败:', error)
  }
}
</script>
```

### 4. 画布集成

在 `useWebAVControls.ts` 中添加文本精灵管理：

```typescript
// 添加文本精灵替换方法
const replaceTextSprite = (oldSprite: TextVisibleSprite, newSprite: TextVisibleSprite) => {
  if (avCanvas.value) {
    // 移除旧精灵
    avCanvas.value.removeSprite(oldSprite)
    
    // 添加新精灵
    avCanvas.value.addSprite(newSprite)
    
    // 更新时间轴项目中的引用
    const timelineItem = videoStore.timelineItems.find(item => 
      item.sprite === oldSprite
    )
    if (timelineItem) {
      timelineItem.sprite = markRaw(newSprite)
    }
    
    console.log('✅ 文本精灵替换完成')
  }
}
```

## 事件处理

### 监听文本更新事件

```typescript
// 在创建文本精灵时设置事件监听
textSprite.on('propsChange', (changes) => {
  if ('textUpdate' in changes && (changes as any).textUpdate?.needsRecreation) {
    // 处理文本更新，重新创建精灵
    handleTextSpriteUpdate(textSprite, (changes as any).textUpdate)
  }
})

const handleTextSpriteUpdate = async (
  oldSprite: TextVisibleSprite, 
  updateInfo: { text: string; style: TextStyleConfig }
) => {
  // 创建新的精灵实例
  const newSprite = await oldSprite.createUpdatedSprite()
  
  // 替换画布中的精灵
  replaceTextSprite(oldSprite, newSprite)
  
  // 更新属性面板显示
  updatePropertyPanel(newSprite)
}
```

## 类型扩展

### 扩展 MediaType

```typescript
// 在 types/index.ts 中
export type MediaType = 'video' | 'image' | 'audio' | 'text'

// 扩展 MediaItem 接口
export interface MediaItem {
  // ... 现有字段
  textSprite?: Raw<TextVisibleSprite> // 新增文本精灵字段
}
```

### 扩展 TimelineItem

```typescript
// 更新 CustomSprite 类型
export type CustomSprite = VideoVisibleSprite | ImageVisibleSprite | TextVisibleSprite
```

## 最佳实践

### 1. 内存管理

```typescript
// 及时清理不再使用的文本精灵
const cleanupTextSprite = (sprite: TextVisibleSprite) => {
  // 从画布移除
  avCanvas.removeSprite(sprite)
  
  // 销毁底层的 ImgClip
  const clip = sprite.getClip()
  if (clip) {
    clip.destroy()
  }
  
  console.log('🧹 文本精灵已清理')
}

// 在组件卸载时清理缓存
onUnmounted(() => {
  TextHelper.clearCache()
})
```

### 2. 性能优化

```typescript
// 批量更新多个属性
const updateTextSpriteProperties = async (
  sprite: TextVisibleSprite,
  updates: {
    text?: string
    style?: Partial<TextStyleConfig>
    position?: { x: number; y: number }
  }
) => {
  // 一次性更新所有属性，避免多次重建
  if (updates.text && updates.style) {
    await sprite.updateTextAndStyle(updates.text, updates.style)
  } else if (updates.text) {
    await sprite.updateText(updates.text)
  } else if (updates.style) {
    await sprite.updateStyle(updates.style)
  }

  // 更新位置（不需要重建）
  if (updates.position) {
    sprite.rect.x = updates.position.x
    sprite.rect.y = updates.position.y
  }
}

// 文本效果性能优化
const optimizeTextEffects = {
  // 避免过度复杂的效果组合
  validateEffectComplexity: (style: TextStyleConfig) => {
    const hasMultipleEffects = [
      !!style.textShadow,
      !!style.textStroke,
      !!style.textGlow
    ].filter(Boolean).length

    if (hasMultipleEffects > 2) {
      console.warn('⚠️ 使用多种文本效果可能影响渲染性能')
    }
  },

  // 优化发光效果参数
  optimizeGlowSettings: (glow: TextStyleConfig['textGlow']) => {
    if (!glow) return glow

    return {
      ...glow,
      // 限制模糊度以提升性能
      blur: Math.min(glow.blur, 20),
      // 限制扩散范围
      spread: Math.min(glow.spread || 0, 15)
    }
  },

  // 缓存复杂效果的渲染结果
  cacheComplexEffects: true
}
```

### 3. 错误处理

```typescript
// 包装文本精灵操作，提供错误处理
const safeTextSpriteOperation = async <T>(
  operation: () => Promise<T>,
  fallback?: () => T
): Promise<T> => {
  try {
    return await operation()
  } catch (error) {
    console.error('❌ 文本精灵操作失败:', error)
    
    if (fallback) {
      console.log('🔄 使用降级方案')
      return fallback()
    }
    
    throw error
  }
}

// 使用示例
const updateTextSafely = async (sprite: TextVisibleSprite, newText: string) => {
  return safeTextSpriteOperation(
    () => sprite.updateText(newText),
    () => {
      console.warn('⚠️ 文本更新失败，保持原文本')
      return sprite
    }
  )
}
```

## 总结

`TextVisibleSprite` 的集成主要涉及：

1. **媒体库**: 添加文本素材创建功能
2. **时间轴**: 处理文本片段的拖拽和时间管理
3. **属性面板**: 提供文本编辑界面和效果控制
4. **画布**: 管理文本精灵的生命周期
5. **事件系统**: 处理文本更新和精灵替换
6. **文本效果**: 支持阴影、描边、发光等视觉效果

### 文本效果功能特点

- **实时预览**: 所有效果参数调整都会立即在画布上显示
- **参数验证**: 所有数值输入都有合理的范围限制
- **状态同步**: 选择不同文本项目时会自动同步其效果设置
- **效果叠加**: 阴影和发光效果可以同时使用
- **历史记录**: 所有更改都通过命令模式支持撤销/重做
- **性能优化**: 通过缓存和参数限制确保流畅的编辑体验

### 支持的效果类型

| 效果类型 | 参数 | 范围 | 说明 |
|---------|------|------|------|
| 阴影 | 偏移X/Y | -20px ~ 20px | 文字阴影偏移 |
| 阴影 | 模糊度 | 0px ~ 20px | 阴影模糊程度 |
| 阴影 | 颜色 | 任意颜色 | 阴影颜色 |
| 描边 | 宽度 | 0px ~ 10px | 描边线条宽度 |
| 描边 | 颜色 | 任意颜色 | 描边颜色 |
| 发光 | 模糊度 | 1px ~ 30px | 发光模糊程度 |
| 发光 | 扩散 | 0px ~ 20px | 发光扩散范围 |
| 发光 | 颜色 | 任意颜色 | 发光颜色 |

通过合理的架构设计和事件处理，结合丰富的文本效果功能，可以实现专业级的文本编辑体验。
