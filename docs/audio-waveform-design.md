# 音频波形渲染技术设计方案（简化版）

## 概述

本文档描述了基于直接PCM数据获取的简化音频波形渲染方案，利用 `getPCMData` 的高效数据访问能力，实现实时动态渲染，无需复杂的缓存系统。

## 设计背景

### 技术优势
- **直接数据访问**：`getPCMData` 可直接获取音频数据，无需重复解码
- **实时渲染**：根据视口参数动态生成波形，响应快速
- **简化架构**：避免复杂的缓存管理系统，降低维护成本

### 核心参数
基于现有的 [`sampleWaveform`](../frontend/src/unified/components/renderers/AudioContent.vue#L22) 计算属性：
- `viewportTLStartFrame`：视口开始帧
- `viewportTLEndFrame`：视口结束帧  
- `clipWidthPixels`：Clip像素宽度

## 核心架构设计

### 设计原则
1. **实时动态渲染**：直接根据视口参数实时生成波形
2. **无缓存依赖**：利用 `getPCMData` 的高效数据获取
3. **Canvas 直接绘制**：避免复杂的缓存管理系统

### 核心数据获取函数
```typescript
// 通用波形数据获取函数
async function getWaveformDataDirectly(
  audioClip: AudioClip,
  startFrame: number,
  endFrame: number
): Promise<Float32Array> {
  // 将帧转换为时间（微秒）
  const startTime = framesToMicroseconds(startFrame)
  const endTime = framesToMicroseconds(endFrame)
  
  // 使用getPCMData获取原始音频数据
  const pcmData = await audioClip.getPCMData(startTime, endTime)
  return pcmData.channelData[0] // 返回第一个声道的数据
}
```

## 渲染实现方案

### 核心渲染函数
```typescript
// 实时波形渲染函数
function renderWaveformDirectly(
  canvas: HTMLCanvasElement,
  audioClip: AudioClip,
  viewportTLStartFrame: number,
  viewportTLEndFrame: number,
  clipWidthPixels: number,
  options: RenderOptions = {}
) {
  const ctx = canvas.getContext('2d')!
  const width = clipWidthPixels
  const height = options.height || 40
  
  // 清空画布
  ctx.clearRect(0, 0, width, height)
  
  // 获取当前视口的PCM数据
  getWaveformDataDirectly(audioClip, viewportTLStartFrame, viewportTLEndFrame)
    .then((samples) => {
      // 使用Canvas渲染实现绘制波形
      renderWaveformToCanvas(ctx, samples, width, height, options)
    })
    .catch((error) => {
      console.error('波形渲染失败:', error)
      // 显示错误状态或默认波形
      renderFallbackWaveform(ctx, width, height)
    })
}
```

### Canvas 渲染实现
```typescript
function renderWaveformToCanvas(
  ctx: CanvasRenderingContext2D,
  samples: Float32Array,
  width: number,
  height: number,
  options: RenderOptions
) {
  const centerY = height / 2
  const amplitude = options.amplitude || 0.8
  const waveColor = options.waveColor || '#4ade80'
  const fillColor = options.fillColor || 'rgba(74, 222, 128, 0.2)'
  
  const sampleSpacing = width / samples.length
  
  // 绘制波形线
  ctx.beginPath()
  for (let i = 0; i < samples.length; i++) {
    const x = i * sampleSpacing
    const y = centerY - samples[i] * centerY * amplitude
    
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }
  
  ctx.strokeStyle = waveColor
  ctx.lineWidth = options.lineWidth || 1
  ctx.stroke()
  
  // 可选：填充波形区域
  if (options.fill) {
    ctx.lineTo(width, centerY)
    ctx.lineTo(0, centerY)
    ctx.closePath()
    ctx.fillStyle = fillColor
    ctx.fill()
  }
}
```

## 性能优化

### 渲染节流控制
```typescript
// 使用lodash的throttle函数控制渲染频率（333ms，与视频缩略图保持一致）
import { throttle } from 'lodash'

// 创建节流渲染函数
const throttledRenderWaveform = throttle(
  (canvas: HTMLCanvasElement, audioClip: AudioClip,
   viewportTLStartFrame: number, viewportTLEndFrame: number,
   clipWidthPixels: number, options: RenderOptions) => {
    renderWaveformDirectly(canvas, audioClip, viewportTLStartFrame,
                          viewportTLEndFrame, clipWidthPixels, options)
  },
  333, // 333ms节流时间
  { leading: false, trailing: true } // 与视频缩略图相同的配置
)
```

### 视口变化检测优化
```typescript
// 只在视口发生显著变化时重新渲染
let lastViewportParams = { start: 0, end: 0, width: 0 }

function shouldReRender(
  viewportTLStartFrame: number,
  viewportTLEndFrame: number,
  clipWidthPixels: number
): boolean {
  const current = { start: viewportTLStartFrame, end: viewportTLEndFrame, width: clipWidthPixels }
  const significantChange = 
    Math.abs(current.start - lastViewportParams.start) > 10 ||
    Math.abs(current.end - lastViewportParams.end) > 10 ||
    Math.abs(current.width - lastViewportParams.width) > 5
  
  if (significantChange) {
    lastViewportParams = current
    return true
  }
  return false
}
```


## 整合到 AudioContent.vue 的方案

### 现有组件分析
当前的 [`AudioContent.vue`](../frontend/src/unified/components/renderers/AudioContent.vue) 组件已经包含：
1. **基础结构**：Vue 3 Composition API + TypeScript
2. **计算属性**：`sampleWaveform` 计算视口参数
3. **依赖注入**：使用 `useUnifiedStore()` 访问全局状态

### 整合策略

#### 1. 模板修改方案
```vue
<!-- 替换现有的文本显示为Canvas波形 -->
<template>
  <div class="audio-content" :class="{ selected: isSelected }">
    <!-- 波形Canvas容器 -->
    <canvas
      ref="waveformCanvas"
      :width="sampleWaveform?.clipWidthPixels || 0"
      :height="40"
      class="waveform-canvas"
    />
    
    <!-- 可选：保持原有的调试信息显示（开发阶段） -->
    <div v-if="showDebugInfo" class="debug-info">
      {{ sampleWaveform?.viewportTLStartFrame }} | {{ sampleWaveform?.clipWidthPixels }} | {{ sampleWaveform?.viewportTLEndFrame }}
    </div>
  </div>
</template>
```

#### 2. 脚本部分整合方案

**新增导入**：
```typescript
import { throttle } from 'lodash'
import { framesToMicroseconds } from '@/unified/utils/timeUtils'
```

**新增响应式引用**：
```typescript
const waveformCanvas = ref<HTMLCanvasElement>()
const showDebugInfo = ref(false) // 开发调试开关
```

**新增核心函数**：
```typescript
// Vue组件专用的数据获取包装函数
async function getWaveformDataForComponent(startFrame: number, endFrame: number): Promise<Float32Array> {
  const mediaItem = unifiedStore.getMediaItem(props.data.mediaItemId)
  if (!mediaItem?.webav?.audioClip) return new Float32Array()
  
  // 复用通用的波形数据获取函数
  return getWaveformDataDirectly(mediaItem.webav.audioClip, startFrame, endFrame)
}

// 核心渲染逻辑（使用通用的renderWaveformDirectly函数）
function renderWaveformInComponent() {
  if (!waveformCanvas.value || !sampleWaveform.value) return
  
  const { viewportTLStartFrame, viewportTLEndFrame, clipWidthPixels } = sampleWaveform.value
  const mediaItem = unifiedStore.getMediaItem(props.data.mediaItemId)
  
  if (mediaItem?.webav?.audioClip) {
    renderWaveformDirectly(
      waveformCanvas.value,
      mediaItem.webav.audioClip,
      viewportTLStartFrame,
      viewportTLEndFrame,
      clipWidthPixels,
      {
        waveColor: '#4ade80',
        fill: true,
        amplitude: 0.7,
        height: 40
      }
    )
  }
}
```

#### 3. 监听器设置方案
```typescript
// 节流渲染函数（333ms，与视频缩略图一致）
const throttledRenderWaveform = throttle(renderWaveformInComponent, 333, {
  leading: false,
  trailing: true
})

// 监听sampleWaveform变化（主要触发条件）
watch(() => sampleWaveform.value, (newValue) => {
  if (newValue && waveformCanvas.value) {
    throttledRenderWaveform()
  }
}, { deep: true })

// 组件挂载时初始渲染
onMounted(() => {
  if (sampleWaveform.value) {
    throttledRenderWaveform()
  }
})

// 组件卸载时清理
onUnmounted(() => {
  throttledRenderWaveform.cancel()
})
```

#### 4. 样式调整方案
```css
/* 保持现有audio-content样式，添加波形相关样式 */
.audio-content {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center; /* 保持居中显示 */
}

.waveform-canvas {
  width: 100%;
  height: 40px;
}

.debug-info {
  position: absolute;
  top: 4px;
  left: 8px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(0, 0, 0, 0.5);
  padding: 2px 4px;
  border-radius: 2px;
  pointer-events: none;
  z-index: 10;
}
```

### 5. 渐进式集成策略

#### 第一阶段：基础渲染
1. 添加Canvas元素和基础渲染逻辑
2. 实现基本的PCM数据获取和波形绘制
3. 保持现有的调试信息显示

#### 第二阶段：性能优化
1. 集成333ms节流渲染
2. 添加错误处理和降级方案
3. 优化内存使用和渲染性能

#### 第三阶段：生产就绪
1. 移除调试信息
2. 完善错误处理和用户体验
3. 性能测试和优化

### 6. 向后兼容性
- 保持现有的 `sampleWaveform` 计算属性不变
- 原有的调试信息可通过 `showDebugInfo` 控制显示
- 错误情况下可回退到文本显示模式

## 总结

这个简化方案充分利用了 `getPCMData` 的直接数据访问优势，实现了高性能的实时波形渲染。相比复杂的缓存架构，这个方案更加简洁高效，适合音频波形这种需要实时更新的可视化需求。
