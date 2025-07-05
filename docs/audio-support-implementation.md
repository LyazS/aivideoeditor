# 音频支持实现方案

## 项目现状分析

### 已有基础设施
- ✅ **类型系统完善**：`AudioMediaConfig`、`AudioState` 等音频相关类型已定义
- ✅ **AudioVisibleSprite 已实现**：具备完整的音频处理能力
  - 音量控制和增益调整
  - 时间范围管理（使用 VideoTimeRange）
  - 音频拦截器实现
  - 播放速度控制
- ✅ **时间轴架构成熟**：支持多媒体类型的统一处理
- ✅ **WebAV 集成**：已有 MP4Clip、ImgClip 的处理经验

### 当前限制
- ❌ 缺少 AudioClip 的创建和管理
- ❌ 音频文件导入流程未实现
- ❌ 缺少 TimelineAudioClip UI 组件
- ❌ 音频轨道创建被禁用
- ❌ 缺少音频波形可视化

## 实现方案

### 阶段一：基础音频支持

#### 1.1 扩展 WebAV 控制器
**文件**：`frontend/src/composables/useWebAVControls.ts`

**需要添加的方法**：
```typescript
/**
 * 创建AudioClip
 * @param file 音频文件
 */
const createAudioClip = async (file: File): Promise<Raw<AudioClip>> => {
  try {
    console.log(`Creating AudioClip for: ${file.name}`)
    
    // 创建AudioClip
    const response = new Response(file)
    const audioClip = markRaw(new AudioClip(response.body!))
    
    // 等待AudioClip准备完成
    await audioClip.ready
    
    console.log(`AudioClip created successfully for: ${file.name}`)
    return audioClip
  } catch (err) {
    const errorMessage = `创建AudioClip失败: ${(err as Error).message}`
    console.error('AudioClip creation error:', err)
    throw new Error(errorMessage)
  }
}

/**
 * 克隆AudioClip实例
 * @param originalClip 原始AudioClip
 */
const cloneAudioClip = async (originalClip: Raw<AudioClip>): Promise<Raw<AudioClip>> => {
  try {
    console.log('Cloning AudioClip...')
    
    // 使用WebAV内置的clone方法
    const clonedClip = await originalClip.clone()
    
    console.log('AudioClip cloned successfully')
    return markRaw(clonedClip)
  } catch (err) {
    const errorMessage = `克隆AudioClip失败: ${(err as Error).message}`
    console.error('AudioClip clone error:', err)
    throw new Error(errorMessage)
  }
}
```

**导出方法**：
```typescript
return {
  // ... 现有方法
  createAudioClip,
  cloneAudioClip,
}
```

#### 1.2 扩展 MediaItem 类型
**文件**：`frontend/src/types/index.ts`

**修改 MediaItem 接口**：
```typescript
export interface MediaItem {
  id: string
  name: string
  file: File
  url: string
  duration: number // 素材时长（帧数）
  type: string
  mediaType: MediaType
  mp4Clip: Raw<MP4Clip> | null // 视频文件
  imgClip: Raw<ImgClip> | null // 图片文件
  audioClip: Raw<AudioClip> | null // 音频文件 - 新增
  isReady: boolean
  status: MediaStatus
  thumbnailUrl?: string
}
```

#### 1.3 扩展 Sprite 工厂
**文件**：`frontend/src/utils/spriteFactory.ts`

**修改 createSpriteFromMediaItem 方法**：
```typescript
export async function createSpriteFromMediaItem(
  mediaItem: MediaItem,
): Promise<VideoVisibleSprite | ImageVisibleSprite | AudioVisibleSprite> {
  // 检查媒体项目是否已准备好
  if (!mediaItem.isReady) {
    throw new Error(`素材尚未解析完成: ${mediaItem.name}`)
  }

  const webAVControls = useWebAVControls()

  if (mediaItem.mediaType === 'video') {
    if (!mediaItem.mp4Clip) {
      throw new Error(`视频素材解析失败，无法创建sprite: ${mediaItem.name}`)
    }
    const clonedMP4Clip = await webAVControls.cloneMP4Clip(mediaItem.mp4Clip)
    return new VideoVisibleSprite(clonedMP4Clip)
  } else if (mediaItem.mediaType === 'image') {
    if (!mediaItem.imgClip) {
      throw new Error(`图片素材解析失败，无法创建sprite: ${mediaItem.name}`)
    }
    const clonedImgClip = await webAVControls.cloneImgClip(mediaItem.imgClip)
    return new ImageVisibleSprite(clonedImgClip)
  } else if (mediaItem.mediaType === 'audio') {
    if (!mediaItem.audioClip) {
      throw new Error(`音频素材解析失败，无法创建sprite: ${mediaItem.name}`)
    }
    const clonedAudioClip = await webAVControls.cloneAudioClip(mediaItem.audioClip)
    return new AudioVisibleSprite(clonedAudioClip)
  } else {
    throw new Error(`不支持的媒体类型: ${mediaItem.mediaType}`)
  }
}
```

#### 1.4 音频文件导入支持
**文件**：`frontend/src/components/MediaLibrary.vue`

**扩展文件类型检测**：
```typescript
// 支持的音频文件类型
const SUPPORTED_AUDIO_TYPES = [
  'audio/mpeg',     // .mp3
  'audio/wav',      // .wav
  'audio/mp4',      // .m4a
  'audio/aac',      // .aac
  'audio/ogg',      // .ogg
  'audio/webm',     // .webm
]

// 在 getMediaType 函数中添加音频检测
function getMediaType(file: File): MediaType {
  if (file.type.startsWith('video/')) {
    return 'video'
  } else if (file.type.startsWith('image/')) {
    return 'image'
  } else if (SUPPORTED_AUDIO_TYPES.includes(file.type)) {
    return 'audio'
  } else {
    throw new Error(`不支持的文件类型: ${file.type}`)
  }
}
```

**添加音频文件处理逻辑**：
```typescript
// 在 handleFileUpload 方法中添加音频处理分支
if (mediaType === 'audio') {
  // 创建解析中状态的音频素材
  const parsingMediaItem: MediaItem = {
    id: mediaItemId,
    name: file.name,
    file: file,
    url: url,
    duration: 0, // 音频时长待解析后确定
    type: file.type,
    mediaType: 'audio',
    mp4Clip: null,
    imgClip: null,
    audioClip: null, // 解析中时为null
    isReady: false,
    status: 'parsing',
  }

  console.log(`📋 创建解析中的音频MediaItem: ${parsingMediaItem.name} (ID: ${mediaItemId})`)

  // 先添加解析中状态的素材到store
  videoStore.addMediaItem(parsingMediaItem)

  // 异步创建AudioClip
  console.log(`🎵 Creating AudioClip for: ${file.name}`)
  const audioClip = await webAVControls.createAudioClip(file)
  console.log(`✅ AudioClip created successfully for: ${file.name}`)

  // 获取AudioClip的元数据
  const meta = await audioClip.ready
  const durationFrames = secondsToFrames(meta.duration / 1_000_000) // meta.duration是微秒

  console.log(`📊 AudioClip元数据: ${file.name}`, {
    duration: meta.duration / 1_000_000 + 's',
    durationFrames: durationFrames + '帧',
    channels: meta.numberOfChannels,
    sampleRate: meta.sampleRate,
  })

  // 更新MediaItem为就绪状态
  const readyMediaItem: MediaItem = {
    ...parsingMediaItem,
    duration: durationFrames,
    audioClip: audioClip,
    isReady: true,
    status: 'ready',
    thumbnailUrl: generateAudioDefaultIcon(), // 音频使用默认图标
  }

  videoStore.updateMediaItem(readyMediaItem)
  console.log(`✅ 音频素材解析完成: ${file.name}`)
}

// 生成音频默认图标
function generateAudioDefaultIcon(): string {
  // 生成音频默认图标 - 使用纯SVG图形
  const svg = `<svg width="60" height="40" xmlns="http://www.w3.org/2000/svg"><rect width="60" height="40" fill="#4CAF50" rx="4"/><g fill="white" transform="translate(30, 20)"><circle cx="-6" cy="8" r="3"/><circle cx="6" cy="6" r="3"/><rect x="-3" y="-2" width="1.5" height="10"/><rect x="9" y="-4" width="1.5" height="10"/><path d="M -1.5 -2 Q 6 -6 10.5 -4 L 10.5 -2 Q 6 -4 -1.5 0 Z"/></g></svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}
```

#### 1.5 创建 TimelineAudioClip 组件
**新建文件**：`frontend/src/components/TimelineAudioClip.vue`

```vue
<template>
  <TimelineBaseClip
    ref="baseClipRef"
    :timeline-item="timelineItem"
    :track="track"
    :timeline-width="timelineWidth"
    :total-duration-frames="totalDurationFrames"
    class="audio-clip"
    @select="$emit('select', $event)"
    @update-position="(timelineItemId, newPosition, newTrackId) => $emit('update-position', timelineItemId, newPosition, newTrackId)"
    @remove="$emit('remove', $event)"
  >
    <template #content="{ timelineItem }">
      <!-- 音频内容显示区域 -->
      <div class="audio-content">
        <!-- 音频波形显示 -->
        <div v-if="showWaveform" class="audio-waveform">
          <svg
            :width="clipWidth"
            :height="clipHeight - 20"
            class="waveform-svg"
          >
            <!-- 波形路径 -->
            <path
              :d="waveformPath"
              fill="none"
              stroke="currentColor"
              stroke-width="1"
              opacity="0.7"
            />
          </svg>
        </div>

        <!-- 音频信息显示 -->
        <div class="audio-info">
          <div class="audio-name">{{ audioDisplayName }}</div>
          <div class="audio-duration">{{ formatDurationFromFrames(audioDurationFrames) }}</div>
        </div>

        <!-- 音频控制指示器 -->
        <div class="audio-controls">
          <div v-if="audioConfig.isMuted" class="mute-indicator">🔇</div>
          <div class="volume-indicator">{{ Math.round(audioConfig.volume * 100) }}%</div>
        </div>
      </div>

      <!-- 工具提示 -->
      <ClipTooltip
        v-if="showTooltip"
        :timeline-item="timelineItem"
        :mouse-position="tooltipPosition"
        :format-duration="formatDurationFromFrames"
      />
    </template>
  </TimelineBaseClip>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { framesToTimecode } from '../stores/utils/timeUtils'
import TimelineBaseClip from './TimelineBaseClip.vue'
import ClipTooltip from './ClipTooltip.vue'
import type { TimelineItem, Track, AudioMediaConfig } from '../types'

interface Props {
  timelineItem: TimelineItem<'audio'>
  track?: Track
  timelineWidth: number
  totalDurationFrames: number
}

interface Emits {
  (e: 'select', itemId: string): void
  (e: 'update-position', timelineItemId: string, newPosition: number, newTrackId?: string): void
  (e: 'remove', timelineItemId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const videoStore = useVideoStore()

// TimelineBaseClip组件引用
const baseClipRef = ref<InstanceType<typeof TimelineBaseClip>>()

// 获取对应的MediaItem
const mediaItem = computed(() => {
  return videoStore.getMediaItem(props.timelineItem.mediaItemId)
})

// 音频配置
const audioConfig = computed(() => props.timelineItem.config as AudioMediaConfig)

// 音频显示名称
const audioDisplayName = computed(() => {
  return mediaItem.value?.name || '音频文件'
})

// 音频时长（帧数）
const audioDurationFrames = computed(() => {
  const timeRange = props.timelineItem.timeRange
  return timeRange.effectiveDuration || 0
})

// 计算clip的尺寸
const clipWidth = computed(() => {
  const timeRange = props.timelineItem.timeRange
  const durationFrames = timeRange.timelineEndTime - timeRange.timelineStartTime
  return videoStore.frameToPixel(durationFrames, props.timelineWidth)
})

const clipHeight = computed(() => {
  return props.track?.height || 60
})

// 是否显示波形
const showWaveform = computed(() => {
  return clipWidth.value > 100 // 只有在clip足够宽时才显示波形
})

// 简化的波形路径（实际应该从音频数据生成）
const waveformPath = computed(() => {
  if (!showWaveform.value) return ''

  // 生成简单的示例波形
  const width = clipWidth.value
  const height = clipHeight.value - 20
  const centerY = height / 2

  let path = `M 0 ${centerY}`
  const samples = Math.min(width / 2, 200) // 控制采样点数量

  for (let i = 1; i < samples; i++) {
    const x = (i / samples) * width
    const amplitude = Math.sin(i * 0.1) * Math.random() * 0.3 + 0.1
    const y = centerY + amplitude * centerY * (Math.random() > 0.5 ? 1 : -1)
    path += ` L ${x} ${y}`
  }

  return path
})

// 工具提示相关
const showTooltip = ref(false)
const tooltipPosition = ref({ x: 0, y: 0 })

function formatDurationFromFrames(frames: number): string {
  return framesToTimecode(frames)
}

onMounted(() => {
  console.log('TimelineAudioClip组件挂载完成:', props.timelineItem.id)
})
</script>

<style scoped>
/* TimelineAudioClip特有样式 */
.audio-clip {
  background: linear-gradient(135deg, #4CAF50, #45a049);
  color: white;
}

.audio-content {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 4px 8px;
}

.audio-waveform {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 20px;
}

.waveform-svg {
  width: 100%;
  height: 100%;
}

.audio-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  margin-top: 2px;
}

.audio-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 60%;
}

.audio-duration {
  font-size: 10px;
  opacity: 0.9;
}

.audio-controls {
  position: absolute;
  top: 2px;
  right: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
}

.mute-indicator {
  color: #ff6b6b;
}

.volume-indicator {
  opacity: 0.8;
}

/* 重叠状态的特殊样式 */
.audio-clip.overlapping {
  background: linear-gradient(135deg, #ff9800, #f57c00) !important;
}
</style>
```

#### 1.6 移除音频轨道限制
**文件**：`frontend/src/components/Timeline.vue`

**修改 addNewTrack 方法**：
```typescript
async function addNewTrack(type: TrackType = 'video') {
  try {
    // 移除音频轨道限制
    const newTrackId = await videoStore.addTrackWithHistory(type)
    if (newTrackId) {
      console.log('✅ 轨道添加成功，新轨道ID:', newTrackId, '类型:', type)

      // 显示成功提示
      if (type === 'text') {
        dialogs.showSuccess('文本轨道创建成功！现在可以右键点击轨道添加文本内容。')
      } else if (type === 'audio') {
        dialogs.showSuccess('音频轨道创建成功！现在可以拖拽音频文件到轨道中。')
      }
    } else {
      console.error('❌ 轨道添加失败')
    }
  } catch (error) {
    console.error('❌ 添加轨道时出错:', error)
    dialogs.showOperationError('添加轨道', (error as Error).message)
  }
}
```

**修改 getClipComponent 方法**：
```typescript
function getClipComponent(mediaType: MediaType) {
  switch (mediaType) {
    case 'text':
      return TimelineTextClip
    case 'audio':
      return TimelineAudioClip
    case 'video':
    case 'image':
    default:
      return TimelineVideoClip
  }
}
```

### 阶段二：音频可视化增强

#### 2.1 音频波形生成工具
**新建文件**：`frontend/src/utils/audioWaveform.ts`

```typescript
/**
 * 音频波形生成工具
 */

export interface WaveformData {
  peaks: number[]
  duration: number
  sampleRate: number
}

export interface WaveformOptions {
  width: number
  height: number
  samples: number
  color: string
}

/**
 * 从音频文件生成波形数据
 */
export async function generateWaveformData(
  audioFile: File,
  samples: number = 200
): Promise<WaveformData> {
  return new Promise((resolve, reject) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const fileReader = new FileReader()

    fileReader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

        const channelData = audioBuffer.getChannelData(0) // 使用第一个声道
        const blockSize = Math.floor(channelData.length / samples)
        const peaks: number[] = []

        for (let i = 0; i < samples; i++) {
          const start = i * blockSize
          const end = start + blockSize
          let max = 0

          for (let j = start; j < end; j++) {
            const value = Math.abs(channelData[j])
            if (value > max) max = value
          }

          peaks.push(max)
        }

        resolve({
          peaks,
          duration: audioBuffer.duration,
          sampleRate: audioBuffer.sampleRate
        })
      } catch (error) {
        reject(error)
      }
    }

    fileReader.onerror = () => reject(new Error('读取音频文件失败'))
    fileReader.readAsArrayBuffer(audioFile)
  })
}

/**
 * 生成波形SVG路径
 */
export function generateWaveformPath(
  peaks: number[],
  options: WaveformOptions
): string {
  const { width, height, samples } = options
  const centerY = height / 2
  const stepX = width / samples

  let path = `M 0 ${centerY}`

  peaks.forEach((peak, index) => {
    const x = index * stepX
    const amplitude = peak * centerY * 0.8 // 限制最大振幅
    const y1 = centerY - amplitude
    const y2 = centerY + amplitude

    if (index === 0) {
      path += ` L ${x} ${y1}`
    } else {
      path += ` L ${x} ${y1}`
    }
  })

  // 绘制下半部分
  for (let i = peaks.length - 1; i >= 0; i--) {
    const x = i * stepX
    const amplitude = peaks[i] * centerY * 0.8
    const y2 = centerY + amplitude
    path += ` L ${x} ${y2}`
  }

  path += ' Z'
  return path
}


```

### 阶段三：高级功能规划

#### 3.1 音频效果系统
- 淡入淡出效果
- 音频均衡器
- 音频滤镜（回声、混响等）

#### 3.2 音频编辑功能
- 音频剪切和分割
- 音频合并
- 音频同步调整

#### 3.3 性能优化
- 音频数据缓存策略
- 大文件分段处理
- 波形渲染优化

## 实现检查清单

### 阶段一基础功能
- [ ] 扩展 useWebAVControls 支持 AudioClip
- [ ] 修改 MediaItem 类型添加 audioClip 字段
- [ ] 更新 spriteFactory 支持音频
- [ ] 扩展 MediaLibrary 支持音频文件导入
- [ ] 创建 TimelineAudioClip 组件
- [ ] 移除音频轨道创建限制
- [ ] 更新 Timeline 组件的 getClipComponent 方法

### 阶段二可视化功能
- [ ] 实现音频波形生成工具
- [ ] 在 TimelineAudioClip 中集成波形显示
- [ ] 优化音频缩略图生成

### 阶段三高级功能
- [ ] 音频效果系统
- [ ] 音频编辑功能
- [ ] 性能优化

## 注意事项

1. **WebAV 兼容性**：确保使用的 AudioClip API 与项目中的 WebAV 版本兼容
2. **性能考虑**：音频文件通常较大，需要考虑内存使用和加载性能
3. **浏览器兼容性**：音频处理 API 在不同浏览器中的支持情况
4. **用户体验**：音频文件加载时间较长，需要提供适当的加载提示
5. **错误处理**：音频文件格式多样，需要完善的错误处理机制

## 测试建议

1. **文件格式测试**：测试各种音频格式（MP3、WAV、M4A等）
2. **大文件测试**：测试大音频文件的处理性能
3. **并发测试**：测试同时导入多个音频文件
4. **兼容性测试**：测试与现有视频、图片功能的兼容性
5. **用户操作测试**：测试拖拽、剪切、移动等操作
```
