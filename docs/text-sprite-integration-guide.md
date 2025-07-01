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
  color: 'white',
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

// 同时更新文本和样式
await textSprite.updateTextAndStyle('最终文本', {
  fontSize: 72,
  color: 'blue'
})
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

创建 `TextPropertiesPanel.vue` 组件：

```vue
<template>
  <div class="text-properties-panel">
    <div class="property-group">
      <label>文本内容</label>
      <textarea 
        v-model="localText" 
        @input="debouncedUpdateText"
        placeholder="输入文本内容..."
      />
    </div>
    
    <div class="property-group">
      <label>字体大小</label>
      <input 
        type="number" 
        v-model="localStyle.fontSize" 
        @input="debouncedUpdateStyle"
        min="12" 
        max="200" 
      />
    </div>
    
    <div class="property-group">
      <label>文字颜色</label>
      <input 
        type="color" 
        v-model="localStyle.color" 
        @input="debouncedUpdateStyle"
      />
    </div>
    
    <!-- 更多样式控件... -->
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { debounce } from 'lodash'
import type { TextVisibleSprite } from '../utils/TextVisibleSprite'
import type { TextStyleConfig } from '../types'

const props = defineProps<{
  textSprite: TextVisibleSprite
}>()

const emit = defineEmits<{
  spriteUpdated: [newSprite: TextVisibleSprite]
}>()

const localText = ref(props.textSprite.getText())
const localStyle = ref({ ...props.textSprite.getTextStyle() })

// 防抖更新函数
const debouncedUpdateText = debounce(async () => {
  const newSprite = await props.textSprite.createUpdatedSprite()
  await newSprite.updateText(localText.value)
  emit('spriteUpdated', newSprite)
}, 300)

const debouncedUpdateStyle = debounce(async () => {
  const newSprite = await props.textSprite.createUpdatedSprite()
  await newSprite.updateStyle(localStyle.value)
  emit('spriteUpdated', newSprite)
}, 300)
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
3. **属性面板**: 提供文本编辑界面
4. **画布**: 管理文本精灵的生命周期
5. **事件系统**: 处理文本更新和精灵替换

通过合理的架构设计和事件处理，可以实现流畅的文本编辑体验。
