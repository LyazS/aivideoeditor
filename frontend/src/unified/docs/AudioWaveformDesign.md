# 音频波形设计方案

## 概述

本文档描述了一个基于真实音频数据的波形显示方案，用于替换 `AudioContent.vue` 中当前的模拟数据实现。该方案借鉴了 `UnifiedVideoThumbnailModule` 的成功架构，提供高性能的音频波形处理和显示。

## 当前问题

`AudioContent.vue` 目前使用随机生成的模拟数据来显示音频波形：

```typescript
// 模拟波形数据（实际实现需要从store或管理器中获取）
const waveformBars = computed(() => {
  const barCount = 50
  const bars = []
  
  for (let i = 0; i < barCount; i++) {
    // 生成随机高度，模拟音频波形
    const height = Math.random() * 80 + 10 // 10-90%的高度
    bars.push({
      height,
      width: 100 / barCount
    })
  }
  
  return bars
})
```

## 设计目标

1. **真实数据**：使用真实的音频数据生成波形
2. **高性能**：支持批量处理和缓存机制
3. **响应式**：根据时间轴缩放动态调整波形细节
4. **资源效率**：智能的内存管理和资源释放

## 架构设计

### 1. UnifiedAudioWaveformModule

核心模块，负责音频波形数据的处理和管理：

```typescript
// frontend/src/unified/modules/UnifiedAudioWaveformModule.ts
export function createUnifiedAudioWaveformModule(
  timelineModule: {
    getTimelineItem: (id: string) => UnifiedTimelineItemData | undefined
  },
  mediaModule: {
    getMediaItem: (id: string) => UnifiedMediaItemData | undefined
  }
) {
  // 状态定义
  const waveformCache = ref(new Map<string, CachedWaveform>())
  const pendingRequests = ref(new Map<string, WaveformRequest[]>())
  
  // 节流处理器（333ms节流，与视频缩略图保持一致）
  const throttledProcessor = throttle(processWaveformRequests, 333, {
    leading: false,
    trailing: true,
  })
  
  // 主要方法
  async function requestWaveform(request: WaveformBatchRequest) {}
  async function processWaveformRequests() {}
  function getCachedWaveform(timelineItemId: string) {}
  function cacheWaveform(waveform: CachedWaveform) {}
  
  return {
    requestWaveform,
    getCachedWaveform,
    waveformCache,
    pendingRequests,
  }
}
```

### 2. 数据类型定义

```typescript
// frontend/src/unified/types/waveform.ts
export interface WaveformData {
  peaks: number[] // 归一化的峰值数据 (0-1范围)
  resolution: number // 每个峰值代表的时间分辨率（毫秒）
  sampleRate: number // 音频采样率
  duration: number // 音频时长（微秒）
}

export interface CachedWaveform {
  timelineItemId: string
  waveformData: WaveformData
  timestamp: number
  blobUrl?: string // 可选：序列化后的波形数据URL
}

export interface WaveformBatchRequest {
  timelineItemId: string
  timestamp: number
}

export interface WaveformLayoutItem {
  index: number
  pixelPosition: number
  waveformData: WaveformData | null
}
```

## 处理流程

### 1. 请求阶段

```typescript
// AudioContent.vue 中触发波形请求
watch(thumbnailLayout, newLayout => {
  if (showWaveform.value) {
    unifiedStore.requestWaveform({
      timelineItemId: props.data.id,
      timestamp: Date.now()
    })
  }
}, { deep: true, immediate: true })
```

### 2. 批量处理

```typescript
async function processWaveformRequests(): Promise<void> {
  const requestsSnapshot = new Map(pendingRequests.value)
  pendingRequests.value.clear()
  
  for (const [timelineItemId, requests] of requestsSnapshot) {
    try {
      await processTimelineItemWaveform(timelineItemId, requests)
    } catch (error) {
      console.error('处理波形请求失败:', error)
    }
  }
}
```

### 3. 音频数据分析（使用tick方法）

```typescript
async function analyzeAudioWaveform(
  timelineItem: UnifiedTimelineItemData,
  mediaItem: UnifiedMediaItemData
): Promise<WaveformData> {
  if (!UnifiedMediaItemQueries.isAudio(mediaItem) || !mediaItem.webav?.audioClip) {
    throw new Error('不支持的音频媒体项目')
  }
  
  const audioClip = await mediaItem.webav.audioClip.clone()
  try {
    const meta = await audioClip.ready
    
    // 使用tick方法获取整个音频的波形数据
    const audioData = await extractAudioDataWithTick(audioClip, meta.duration)
    
    // 计算峰值
    const peaks = calculatePeaks(audioData, 100) // 生成100个峰值点
    
    return {
      peaks,
      resolution: meta.duration / peaks.length,
      sampleRate: meta.sampleRate,
      duration: meta.duration
    }
  } finally {
    audioClip.destroy()
  }
}

/**
 * 使用AudioClip的tick方法提取音频数据
 */
async function extractAudioDataWithTick(
  audioClip: AudioClip,
  duration: number
): Promise<Float32Array[]> {
  const allAudioData: Float32Array[] = []
  const step = 100000 // 100ms步长（微秒）
  
  for (let time = 0; time < duration; time += step) {
    const result = await audioClip.tick(time)
    
    if (result.state === 'success' && result.audio) {
      // 合并音频数据
      result.audio.forEach((channelData, channelIndex) => {
        if (!allAudioData[channelIndex]) {
          allAudioData[channelIndex] = new Float32Array(0)
        }
        
        // 合并通道数据
        const merged = new Float32Array(allAudioData[channelIndex].length + channelData.length)
        merged.set(allAudioData[channelIndex])
        merged.set(channelData, allAudioData[channelIndex].length)
        allAudioData[channelIndex] = merged
      })
    } else if (result.state === 'done') {
      break
    }
  }
  
  return allAudioData
}
```

### 4. 优化的峰值提取算法

```typescript
function calculatePeaks(
  audioData: Float32Array[],
  targetPeaks: number
): number[] {
  const peaks: number[] = []
  
  // 处理空数据情况
  if (!audioData.length || !audioData[0].length) {
    return Array(targetPeaks).fill(0.1) // 返回默认低电平
  }
  
  const totalSamples = audioData[0].length
  const windowSize = Math.max(1, Math.floor(totalSamples / targetPeaks))
  
  for (let i = 0; i < targetPeaks; i++) {
    const start = i * windowSize
    const end = Math.min(start + windowSize, totalSamples)
    const sampleCount = end - start
    
    if (sampleCount <= 0) {
      peaks.push(0)
      continue
    }
    
    // 计算当前窗口的RMS值（均方根）
    let sum = 0
    for (let channel = 0; channel < audioData.length; channel++) {
      for (let j = start; j < end; j++) {
        const sample = audioData[channel][j]
        sum += sample * sample
      }
    }
    
    const rms = Math.sqrt(sum / (audioData.length * sampleCount))
    peaks.push(rms)
  }
  
  // 归一化到0-1范围，避免除零
  const maxPeak = Math.max(...peaks, 0.001) // 最小值为0.001避免除零
  return peaks.map(peak => Math.min(peak / maxPeak, 1))
}

/**
 * 替代方案：如果tick方法性能不佳，可以使用采样方式
 */
async function extractAudioDataSampled(
  audioClip: AudioClip,
  duration: number,
  samplePoints: number = 100
): Promise<Float32Array[]> {
  const sampledData: Float32Array[] = []
  const timeStep = duration / samplePoints
  
  for (let i = 0; i < samplePoints; i++) {
    const time = i * timeStep
    const result = await audioClip.tick(time)
    
    if (result.state === 'success' && result.audio && result.audio.length > 0) {
      // 取每个通道的第一个采样点作为该时间点的值
      const sample = result.audio.map(channel =>
        channel.length > 0 ? Math.abs(channel[0]) : 0
      )
      
      // 初始化通道数组
      if (sampledData.length === 0) {
        for (let j = 0; j < sample.length; j++) {
          sampledData[j] = new Float32Array(samplePoints)
        }
      }
      
      // 存储采样点
      sample.forEach((value, channel) => {
        sampledData[channel][i] = value
      })
    }
  }
  
  return sampledData
}
```

## 性能优化策略

### 1. 分辨率适配

```typescript
function getOptimalPeakCount(
  durationFrames: number,
  zoomLevel: number
): number {
  const basePeaks = 50 // 基础峰值数量
  const zoomFactor = Math.max(1, zoomLevel / 10) // 缩放因子
  return Math.floor(basePeaks * zoomFactor)
}
```

### 2. 视口优化

```typescript
function shouldProcessWaveform(
  timelineItem: UnifiedTimelineItemData,
  viewportStartFrame: number,
  viewportEndFrame: number
): boolean {
  const itemStart = timelineItem.timeRange.timelineStartTime
  const itemEnd = timelineItem.timeRange.timelineEndTime
  
  // 只处理在当前视口内或部分可见的项目
  return itemEnd >= viewportStartFrame && itemStart <= viewportEndFrame
}
```

### 3. 缓存管理

```typescript
function cleanupWaveformCache(maxSize: number = 1000): number {
  if (waveformCache.value.size <= maxSize) return 0
  
  const entries = Array.from(waveformCache.value.entries())
    .sort(([, a], [, b]) => b.timestamp - a.timestamp)
  
  let removedCount = 0
  for (let i = maxSize; i < entries.length; i++) {
    const [key, cached] = entries[i]
    if (cached.blobUrl) {
      URL.revokeObjectURL(cached.blobUrl)
    }
    waveformCache.value.delete(key)
    removedCount++
  }
  
  return removedCount
}
```

## 集成方案

### 1. AudioContent.vue 修改

```typescript
// 替换现有的waveformBars计算属性
const waveformData = computed(() => {
  return unifiedStore.getCachedWaveform(props.data.id)
})

const waveformBars = computed(() => {
  if (!waveformData.value) {
    return generateFallbackBars() // 备用方案：简单的等分条
  }
  
  const { peaks } = waveformData.value
  return peaks.map((peak, index) => ({
    height: peak * 80 + 10, // 映射到10-90%高度
    width: 100 / peaks.length,
    index
  }))
})
```

### 2. Store 集成

```typescript
// 在 unifiedStore.ts 中添加
const unifiedAudioWaveformModule = createUnifiedAudioWaveformModule(
  unifiedTimelineModule,
  unifiedMediaModule
)

// 导出方法
export const useUnifiedStore = () => ({
  // ... 现有导出
  requestWaveform: unifiedAudioWaveformModule.requestWaveform,
  getCachedWaveform: unifiedAudioWaveformModule.getCachedWaveform,
  waveformCache: unifiedAudioWaveformModule.waveformCache,
})
```

## 实施步骤

1. **创建类型定义**：在 `src/unified/types/waveform.ts` 中定义数据类型
2. **实现核心模块**：创建 `UnifiedAudioWaveformModule.ts`
3. **修改Store**：集成波形模块到统一存储
4. **更新AudioContent**：替换模拟数据为真实波形数据
5. **测试优化**：进行性能测试和优化调整

## 预期效果

- ✅ 真实的音频波形显示
- ✅ 高性能的批量处理
- ✅ 智能的缓存管理  
- ✅ 响应式的细节调整
- ✅ 资源的高效利用

这个方案将显著提升音频波形显示的真实性和性能，为用户提供更好的编辑体验。

## 性能优化建议

### 1. 渐进式波形生成
```typescript
// 可以先提供低分辨率波形，然后逐步提高质量
async function generateProgressiveWaveform(
  audioClip: AudioClip,
  duration: number
): Promise<WaveformData> {
  // 第一遍：低分辨率快速预览
  const lowResPeaks = await extractLowResolutionWaveform(audioClip, duration, 20)
  
  // 立即返回低分辨率结果
  requestAnimationFrame(() => {
    // 第二遍：中等分辨率
    generateMediumResolutionWaveform(audioClip, duration, 50)
    
    // 第三遍：高分辨率（如果用户需要）
    if (userRequiresHighQuality) {
      generateHighResolutionWaveform(audioClip, duration, 100)
    }
  })
  
  return lowResPeaks
}
```

### 2. Web Worker处理
对于长时间音频处理，可以使用Web Worker避免阻塞UI：
```typescript
// 在主线程
const waveformWorker = new Worker('./waveform-worker.ts')

waveformWorker.postMessage({
  type: 'ANALYZE_WAVEFORM',
  audioClipData: audioClipData, // 需要序列化的数据
  targetPeaks: 100
})

waveformWorker.onmessage = (event) => {
  if (event.data.type === 'WAVEFORM_RESULT') {
    updateWaveformCache(event.data.waveformData)
  }
}
```

## 测试策略

1. **单元测试**：测试峰值计算算法和归一化逻辑
2. **性能测试**：测量不同长度音频的处理时间
3. **内存测试**：监控缓存内存使用情况
4. **用户体验测试**：验证波形显示的流畅性和准确性

## 实施注意事项

1. **错误处理**：确保AudioClip tick方法的错误被正确捕获和处理
2. **资源清理**：正确销毁克隆的AudioClip实例，避免内存泄漏
3. **降级方案**：当音频处理失败时，提供优雅的降级方案（如继续使用模拟数据）
4. **性能监控**：添加性能指标监控，确保波形生成不会影响主线程性能