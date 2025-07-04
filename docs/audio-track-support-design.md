# 音频轨道支持设计方案

## 📊 实施进度总览

**当前状态**：🎵 **AudioVisibleSprite实现完成** (2025-01-04)

**✅ 已完成的工作**：
- 删除了多余的 `AudioTimeRange` 接口，音频复用 `VideoTimeRange`
- 更新了 `MediaItem` 接口，添加了 `audioClip` 属性
- 扩展了 `CustomSprite` 和 `CustomVisibleSprite` 类型以支持 `AudioVisibleSprite`
- 导出了 `AudioMediaConfig` 接口
- 修复了时间轴项目的时间范围类型映射
- 更新了 `isAudioTimeRange` 函数以使用 `VideoTimeRange`
- **✅ 完成 AudioVisibleSprite 类实现**
  - 继承自 BaseVisibleSprite，遵循现有架构
  - 实现完整的时间轴控制接口
  - 支持音频属性控制（音量、静音、增益）
  - 实现音频拦截器进行实时音频处理
  - 复用 VideoTimeRange 进行时间范围管理
  - 支持播放速度调整和轨道静音检查

| 阶段 | 状态 | 进度 | 预估时间 |
|------|------|------|----------|
| 阶段0：类型系统清理 | ✅ 已完成 | 100% | 1小时 |
| 阶段1：基础音频轨道支持 | 🔄 进行中 | 25% | 16小时 |
| 阶段2：音频编辑功能 | ⏳ 待开始 | 0% | 12小时 |
| 阶段3：高级音频功能 | ⏳ 待开始 | 0% | 12小时 |

**设计目标**：
- 🎵 完整的音频轨道创建和管理
- 🎚️ 音频项目的时间轴显示和操作
- 🔊 音量控制和静音功能
- ⚡ 播放速度调整
- 🎛️ 音频剪辑和编辑功能

---

## 1. 概述

本文档描述了为视频编辑器添加音频轨道支持的完整设计方案。该方案基于现有的视频处理架构，参考文本轨道的成功实现模式，扩展轨道系统以支持音频内容的导入、编辑和管理。

### 1.1 设计目标

- **完整集成**：音频轨道与现有视频/文本轨道系统无缝集成
- **专业功能**：提供专业级音频编辑和控制功能
- **性能优化**：复用现有架构，确保流畅的编辑体验
- **扩展性强**：为未来的音频效果和高级功能预留接口

### 1.2 核心架构

```
音频轨道系统
├── 类型系统扩展
│   ├── AudioTimelineItem (基于现有泛型)
│   ├── AudioMediaConfig (新增)
│   └── VideoTimeRange (复用，音频使用相同时间范围)
├── WebAV音频集成
│   ├── AudioClip支持 (需确认WebAV能力)
│   ├── 音频文件解析 (createAudioClip)
│   └── 音频播放控制 (音频输出)
├── 音频精灵类
│   ├── AudioVisibleSprite (新增)
│   ├── 音频时间控制 (复用VideoVisibleSprite逻辑)
│   └── 音频属性管理 (音量、静音等)
├── UI组件扩展
│   ├── AudioClip组件 (基于BaseClip)
│   ├── AudioClipProperties (音频属性面板)
│   └── 音频波形显示 (可视化组件)
└── 命令系统扩展
    ├── 音频项目操作命令 (新增)
    └── 音频属性更新命令 (新增)
```

## 2. 与现有媒体类型的对比分析

### 2.1 音频 vs 视频的差异

**相同点：**
- ✅ 都基于文件（需要MediaItem）
- ✅ 都有时间范围概念（clipStartTime, clipEndTime）
- ✅ 都支持音量控制和静音
- ✅ 都支持播放速度调整（playbackRate）
- ✅ 都需要WebAV的Clip支持
- ✅ 都可以进行时间轴剪辑操作

**差异点：**
- **视频：** 有视觉属性（位置、大小、旋转等）+ 音频属性
- **音频：** 只有音频属性（音量、静音）+ 基础属性（zIndex）
- **视频：** 在画布上渲染视觉内容
- **音频：** 只输出音频数据，无视觉渲染
- **视频：** 支持变换控制和关键帧动画
- **音频：** 主要支持音频参数的时间轴控制
- **时间范围：** 两者完全相同，都使用VideoTimeRange

### 2.2 音频 vs 文本的架构相似性

**相似的实现模式：**
- 都基于BaseClip组件构建UI
- 都有专门的属性面板组件
- 都使用命令模式实现撤销重做
- 都需要专门的精灵类处理特定逻辑

**可复用的组件和逻辑：**
- BaseClip基础组件（拖拽、选择、调整时长）
- 命令系统架构
- 轨道管理逻辑
- 时间轴集成方式

## 3. 类型系统扩展

### 3.1 音频媒体配置类型

```typescript
// 在 frontend/src/types/index.ts 中扩展

/**
 * 音频媒体配置：只有音频属性和基础属性
 */
interface AudioMediaConfig extends BaseMediaProps, AudioMediaProps {
  // 音频特有属性
  /** 音频增益（dB） */
  gain?: number
}

/**
 * 扩展MediaItem以支持音频
 */
export interface MediaItem {
  // ... 现有属性
  audioClip: Raw<AudioClip> | null  // 新增：音频文件解析后的AudioClip实例
}

/**
 * 音频时间轴项目类型（使用现有泛型）
 * 注意：音频使用VideoTimeRange，因为时间范围概念完全相同
 */
export type AudioTimelineItem = TimelineItem<'audio'>

/**
 * 扩展CustomSprite类型
 */
export type CustomSprite =
  | VideoVisibleSprite
  | ImageVisibleSprite
  | TextVisibleSprite
  | AudioVisibleSprite  // 新增
```

### 3.2 音频关键帧属性

音频关键帧属性已在现有的类型系统中定义，复用 `AudioAnimatableProps`：

```typescript
// 已存在于 types/index.ts 中
interface AudioAnimatableProps extends BaseAnimatableProps {
  volume: number
  // 注意：isMuted 通常不需要动画，但可以考虑添加
}

// 已存在的关键帧属性映射
type KeyframePropertiesMap = {
  video: VisualAnimatableProps & AudioAnimatableProps
  image: VisualAnimatableProps
  audio: AudioAnimatableProps  // 复用现有类型
  text: VisualAnimatableProps
}
```

## 4. AudioVisibleSprite类设计

### 4.1 实现状态

**✅ 已完成实现** - `frontend/src/utils/AudioVisibleSprite.ts`

AudioVisibleSprite 类已成功实现，具备以下特性：

#### 核心架构特点
- **继承设计**：继承自 `BaseVisibleSprite`，遵循现有架构模式
- **时间控制**：复用 `VideoTimeRange` 进行时间范围管理
- **音频处理**：通过 `tickInterceptor` 实现实时音频属性控制
- **接口一致性**：与其他 VisibleSprite 类保持一致的接口设计

#### 主要功能模块

1. **时间轴控制接口**
   - `setClipStartTime()` / `setClipEndTime()` - 素材内部时间控制
   - `setTimelineStartTime()` / `setTimelineEndTime()` - 时间轴位置控制
   - `setDisplayDuration()` - 显示时长设置
   - `setTimeRange()` - 批量时间范围更新

2. **音频属性控制**
   - `setVolume()` / `setMuted()` - 音量和静音控制
   - `setGain()` / `getGain()` - 音频增益控制（-20dB 到 +20dB）
   - `setPlaybackRate()` - 播放速度调整
   - `setTrackMuteChecker()` - 轨道级静音检查

3. **状态管理**
   - `getAudioState()` / `setAudioState()` - 音频状态管理
   - `isTrackMuted()` / `isEffectivelyMuted()` - 静音状态检查
   - `getTimeRange()` - 时间范围获取

#### 技术实现细节

```typescript
// 实际实现的核心架构
export class AudioVisibleSprite extends BaseVisibleSprite {
  // 私有状态管理
  #audioState: AudioState = { volume: 1, isMuted: false }
  #gain: number = 0
  #trackMuteChecker: (() => boolean) | null = null
  #startOffset: number = 0
  #timeRange: VideoTimeRange = { /* 时间范围配置 */ }

  constructor(clip: AudioClip) {
    super(clip)
    this.#setupAudioInterceptor() // 设置音频拦截器
  }

  // 覆写父类方法以支持时间偏移
  public async preFrame(time: number): Promise<void>
  public render(ctx: any, time: number): { audio: Float32Array[] }
}
```

### 4.2 AudioVisibleSprite 实现详解

#### 4.2.1 音频拦截器机制

AudioVisibleSprite 的核心创新是使用 `tickInterceptor` 进行实时音频处理：

```typescript
#setupAudioInterceptor(): void {
  const clip = this.getClip() as AudioClip
  if (clip && 'tickInterceptor' in clip) {
    clip.tickInterceptor = async <T extends Awaited<ReturnType<AudioClip['tick']>>>(
      _time: number,
      tickRet: T,
    ): Promise<T> => {
      if (tickRet.audio && tickRet.audio.length > 0) {
        // 检查轨道静音状态
        const isTrackMuted = this.#trackMuteChecker ? this.#trackMuteChecker() : false

        // 计算有效音量（考虑静音状态）
        const effectiveVolume = this.#audioState.isMuted || isTrackMuted ? 0 : this.#audioState.volume

        // 计算增益倍数（dB转线性）
        const gainMultiplier = Math.pow(10, this.#gain / 20)

        // 应用最终音量到所有声道
        const finalVolume = effectiveVolume * gainMultiplier
        for (const channel of tickRet.audio) {
          for (let i = 0; i < channel.length; i++) {
            channel[i] *= finalVolume
          }
        }
      }
      return tickRet
    }
  }
}
```

#### 4.2.2 时间偏移处理

通过覆写 `preFrame` 和 `render` 方法实现时间偏移：

```typescript
public async preFrame(time: number): Promise<void> {
  const startOffsetMicroseconds = framesToMicroseconds(this.#startOffset)
  const adjustedTime = time + startOffsetMicroseconds
  return super.preFrame(adjustedTime)
}

public render(ctx: any, time: number): { audio: Float32Array[] } {
  const startOffsetMicroseconds = framesToMicroseconds(this.#startOffset)
  const adjustedTime = time + startOffsetMicroseconds
  return super.render(ctx, adjustedTime)
}
```

#### 4.2.3 播放速度控制

播放速度通过时间范围计算自动实现：

```typescript
#updateVisibleSpriteTime(): void {
  const { clipStartTime, clipEndTime, timelineStartTime, timelineEndTime } = this.#timeRange

  const clipDurationFrames = clipEndTime - clipStartTime
  const timelineDurationFrames = timelineEndTime - timelineStartTime

  let playbackRate = 1
  if (clipDurationFrames > 0 && timelineDurationFrames > 0) {
    // playbackRate = 素材内部时长 / 时间轴时长
    playbackRate = clipDurationFrames / timelineDurationFrames
  }

  // 设置WebAV的time属性
  this.time = {
    offset: framesToMicroseconds(timelineStartTime),
    duration: framesToMicroseconds(timelineDurationFrames),
    playbackRate: playbackRate,
  }
}
```

### 4.3 设计优势

#### 4.3.1 架构一致性
- **继承模式**：继承自 `BaseVisibleSprite`，与其他媒体类型保持一致
- **接口统一**：时间控制接口与 `VideoVisibleSprite` 完全一致
- **类型复用**：使用 `VideoTimeRange` 避免重复定义

#### 4.3.2 性能优化
- **实时处理**：通过拦截器避免重建音频clip，提升性能
- **精确控制**：帧级别的时间控制，确保音频同步精度
- **内存效率**：复用现有基础设施，减少内存占用

#### 4.3.3 功能完整性
- **音频属性**：支持音量、静音、增益等完整音频控制
- **轨道集成**：支持轨道级静音检查和控制
- **播放控制**：支持播放速度调整和时间范围控制

### 4.4 接口对比

AudioVisibleSprite 实现的接口与设计文档中的接口基本一致，主要改进包括：

| 设计接口 | 实际实现 | 改进说明 |
|---------|---------|---------|
| `setClipStartTime()` | ✅ 已实现 | 完全按设计实现 |
| `setTimelineStartTime()` | ✅ 已实现 | 完全按设计实现 |
| `setVolume()` / `setMuted()` | ✅ 已实现 | 完全按设计实现 |
| `setGain()` / `getGain()` | ✅ 已实现 | 增加了范围限制（-20dB到+20dB） |
| `setPlaybackRate()` | ✅ 已实现 | 改进：通过时间范围自动计算 |
| `getAudioMetadata()` | ❌ 未实现 | 暂未实现，可在后续版本添加 |
| 音频拦截器 | ✅ 新增 | 设计中未包含，实现中的重要创新 |
| 轨道静音检查 | ✅ 新增 | 设计中未包含，实现中的重要扩展 |



## 5. WebAV集成扩展

### 5.1 音频文件处理

```typescript
// 在 frontend/src/composables/useWebAVControls.ts 中扩展

/**
 * 创建AudioClip
 * @param file 音频文件
 */
const createAudioClip = async (file: File): Promise<Raw<AudioClip>> => {
  try {
    console.log(`Creating AudioClip for: ${file.name}`)

    // 方案1：如果WebAV提供AudioClip
    const response = new Response(file)
    const audioClip = markRaw(new AudioClip(response.body!))
    await audioClip.ready

    // 方案2：如果需要使用MP4Clip处理音频
    // const audioClip = markRaw(new MP4Clip(response.body!))
    // await audioClip.ready

    console.log(`AudioClip created successfully for: ${file.name}`)
    return audioClip
  } catch (err) {
    const errorMessage = `创建AudioClip失败: ${(err as Error).message}`
    console.error('AudioClip creation error:', err)
    throw new Error(errorMessage)
  }
}

// 导出新方法
return {
  // ... 现有方法
  createAudioClip,  // 新增
}
```

### 5.2 音频文件格式支持

**支持的音频格式：**
- **主要格式：** MP3, WAV, AAC, OGG
- **WebAV兼容性：** 需要测试各种格式的支持情况
- **转码需求：** 可能需要音频格式转换

**文件类型检测：**
```typescript
// 在 MediaLibrary.vue 中扩展文件类型检测
function getMediaTypeFromFile(file: File): MediaType {
  const extension = file.name.split('.').pop()?.toLowerCase()
  
  if (['mp4', 'avi', 'mov', 'webm'].includes(extension || '')) {
    return 'video'
  } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
    return 'image'
  } else if (['mp3', 'wav', 'aac', 'ogg', 'm4a', 'flac'].includes(extension || '')) {
    return 'audio'  // 新增音频类型检测
  }
  
  return 'video' // 默认
}
```

## 6. 实施优先级和阶段

### 阶段1：基础音频轨道支持 🎯
**目标**：建立音频轨道的核心基础设施，实现基本的音频项目创建和播放功能。

**预估时间：** 16小时

#### 1.1 WebAV音频能力确认 (2小时)
- 🔍 确认WebAV库是否提供AudioClip类
- 🧪 测试音频文件格式支持情况
- 📋 制定音频处理技术方案

#### 1.2 类型系统扩展 (2小时)
- 📝 扩展AudioMediaConfig类型定义
- 🔧 更新MediaItem支持audioClip
- ✅ 确保类型系统编译通过

#### 1.3 AudioVisibleSprite实现 (4小时)
- 🎵 实现音频精灵类核心功能
- ⏱️ 复用VideoVisibleSprite的时间控制逻辑
- 🔊 实现音频控制方法（音量、静音等）

#### 1.4 基础AudioClip组件 (3小时)
- 🧩 基于BaseClip创建AudioClip组件
- 🎨 设计音频clip的视觉样式
- 📊 实现基础的音频信息显示

#### 1.5 轨道系统集成 (3小时)
- 🛤️ 扩展Timeline组件支持音频轨道
- 🔄 更新轨道兼容性检查逻辑
- 🎛️ 实现音频轨道的创建和管理

#### 1.6 音频文件导入 (2小时)
- 📁 扩展MediaLibrary支持音频文件
- 🔄 实现createAudioClip函数
- ✅ 测试音频文件导入流程

### 阶段2：音频编辑功能 🎚️
**目标**：实现完整的音频编辑功能，包括属性控制和时间轴操作。

**预估时间：** 12小时

#### 2.1 AudioClipProperties组件 (4小时)
- 🎛️ 实现音频属性编辑面板
- 🔊 音量控制和静音功能
- ⚡ 播放速度调整
- 📏 时间范围编辑

#### 2.2 命令系统集成 (3小时)
- 📝 实现音频操作命令类
- ↩️ 集成撤销重做功能
- 🔄 确保命令系统兼容性

#### 2.3 音频剪辑功能 (3小时)
- ✂️ 实现音频clip的分割功能
- 📋 支持音频clip的复制粘贴
- 🗑️ 实现音频clip的删除功能

#### 2.4 属性面板集成 (2小时)
- 🔧 在PropertiesPanel中集成AudioClipProperties
- 🎯 根据选中项目类型动态显示
- ✅ 测试属性编辑功能

### 阶段3：高级音频功能 🚀
**目标**：实现高级音频功能，提升专业编辑能力。

**预估时间：** 12小时

#### 3.1 多轨道音频混音 (4小时)
- 🎚️ 多音频轨道混合
- 🔊 轨道音量平衡
- 🎵 音频轨道独奏/静音

#### 3.2 性能优化 (4小时)
- ⚡ 音频解码性能优化
- 💾 音频缓存机制
- 🔄 大文件处理优化

#### 3.3 音频效果扩展 (4小时)
- 🎵 淡入淡出效果
- 🎛️ 音频滤镜效果
- 📈 音频包络控制

## 7. 关键技术考虑

### 7.1 WebAV库音频支持确认
**优先级：🔴 最高**

需要首先确认WebAV库的音频处理能力：
- 是否提供AudioClip类
- 音频文件格式支持范围
- 音频解码和播放API
- 音频数据访问接口

**备选方案：**
- 如果没有AudioClip，使用MP4Clip处理音频
- 集成第三方音频处理库
- 扩展现有MP4Clip支持纯音频

### 7.2 性能考虑
- **音频解码：** 大音频文件的内存使用优化
- **波形生成：** 实时波形绘制的性能优化
- **多轨道混音：** 多个音频轨道同时播放的性能
- **缓存策略：** 音频数据和波形数据的缓存机制

### 7.3 与现有视频音频的关系
- **视频音频轨：** 视频文件包含的音频部分
- **独立音频轨：** 纯音频文件导入
- **音频同步：** 确保音频与视频的时间同步
- **轨道隔离：** 音频轨道与视频轨道的独立控制

## 8. 实施建议

### 8.1 技术验证优先
1. **WebAV音频能力测试** - 确认技术可行性
2. **音频文件格式测试** - 验证支持范围
3. **性能基准测试** - 确定性能边界

### 8.2 渐进式开发
1. **最小可用产品** - 先实现基础播放功能
2. **功能迭代** - 逐步添加编辑功能
3. **性能优化** - 在功能完善后进行优化

### 8.3 复用现有架构
1. **BaseClip组件** - 直接复用拖拽、选择等功能
2. **命令系统** - 复用撤销重做架构
3. **时间轴管理** - 复用现有时间轴逻辑
4. **文本轨道经验** - 参考文本轨道的成功实现

## 9. UI组件详细设计

### 9.1 AudioClip组件实现

```vue
<!-- frontend/src/components/AudioClip.vue -->
<template>
  <BaseClip
    ref="baseClipRef"
    :timeline-item="timelineItem"
    :track="track"
    :timeline-width="timelineWidth"
    :total-duration-frames="totalDurationFrames"
    class="audio-clip"
    @select="$emit('select', $event)"
    @update-position="$emit('update-position', $event)"
    @remove="$emit('remove', $event)"
  >
    <template #content="{ timelineItem }">
      <!-- 音频信息显示 -->
      <div class="audio-info">
        <div class="audio-name">{{ mediaItem?.name || 'Audio' }}</div>
        <div class="audio-duration">{{ formatDuration(timelineDurationFrames) }}</div>
      </div>

      <!-- 音量指示器 -->
      <div class="volume-indicator" v-if="!audioState.isMuted">
        <div class="volume-bar" :style="{ width: `${audioState.volume * 100}%` }"></div>
      </div>
      <div class="muted-indicator" v-else>🔇</div>
    </template>
  </BaseClip>

  <!-- 音频专用Tooltip -->
  <ClipTooltip
    :visible="baseClipRef?.showTooltipFlag || false"
    :title="mediaItem?.name || 'Unknown'"
    :media-type="'audio'"
    :duration="formatDuration(timelineDurationFrames)"
    :position="formatDuration(props.timelineItem.timeRange.timelineStartTime)"
    :volume="audioState.volume"
    :is-muted="audioState.isMuted"
    :playback-rate="playbackRate"
    :mouse-x="baseClipRef?.tooltipMouseX || 0"
    :mouse-y="baseClipRef?.tooltipMouseY || 0"
    :clip-top="baseClipRef?.tooltipClipTop || 0"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import BaseClip from './BaseClip.vue'
import ClipTooltip from './ClipTooltip.vue'
import { useVideoStore } from '../stores/videoStore'
import type { TimelineItem, Track } from '../types'

interface Props {
  timelineItem: TimelineItem<'audio'>
  track?: Track
  timelineWidth: number
  totalDurationFrames: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'select': [itemId: string]
  'update-position': [timelineItemId: string, newPosition: number, newTrackId?: string]
  'remove': [timelineItemId: string]
}>()

const videoStore = useVideoStore()
const baseClipRef = ref<InstanceType<typeof BaseClip>>()

// 计算属性
const mediaItem = computed(() => {
  return videoStore.getMediaItem(props.timelineItem.mediaItemId)
})

const audioState = computed(() => props.timelineItem.config)
const playbackRate = computed(() => props.timelineItem.timeRange.playbackRate)

const timelineDurationFrames = computed(() => {
  const timeRange = props.timelineItem.timeRange
  return timeRange.timelineEndTime - timeRange.timelineStartTime
})



function formatDuration(frames: number): string {
  // 复用现有的时间格式化逻辑
  return framesToTimecode(frames)
}
</script>

<style scoped>
.audio-clip {
  background: linear-gradient(135deg, #FF9800, #F57C00);
  min-height: 40px;
  position: relative;
  overflow: hidden;
}



.audio-info {
  position: relative;
  z-index: 1;
  padding: 4px 8px;
  color: white;
  font-size: 11px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
}

.audio-name {
  font-weight: 500;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.audio-duration {
  font-size: 10px;
  opacity: 0.8;
}

.volume-indicator {
  position: absolute;
  bottom: 2px;
  left: 4px;
  right: 4px;
  height: 2px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 1px;
}

.volume-bar {
  height: 100%;
  background: #4CAF50;
  border-radius: 1px;
  transition: width 0.2s ease;
}

.muted-indicator {
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 12px;
  color: #f44336;
}
</style>
```

### 9.2 AudioClipProperties组件实现

```vue
<!-- frontend/src/components/AudioClipProperties.vue -->
<template>
  <div class="audio-clip-properties">
    <!-- 基础音频属性 -->
    <div class="properties-section">
      <h3>音频属性</h3>

      <!-- 音量控制 -->
      <div class="property-group">
        <label>音量</label>
        <div class="volume-control">
          <SliderInput
            :model-value="localConfig.volume"
            :min="0"
            :max="1"
            :step="0.01"
            @update:model-value="updateVolume"
          />
          <NumberInput
            :model-value="Math.round(localConfig.volume * 100)"
            :min="0"
            :max="100"
            suffix="%"
            @update:model-value="(val) => updateVolume(val / 100)"
          />
          <button
            @click="toggleMute"
            :class="{ active: localConfig.isMuted }"
            class="mute-button"
            :title="localConfig.isMuted ? '取消静音' : '静音'"
          >
            {{ localConfig.isMuted ? '🔇' : '🔊' }}
          </button>
        </div>
      </div>

      <!-- 播放速度 -->
      <div class="property-group">
        <label>播放速度</label>
        <div class="speed-control">
          <SliderInput
            :model-value="playbackRate"
            :min="0.25"
            :max="4"
            :step="0.25"
            @update:model-value="updatePlaybackRate"
          />
          <span class="speed-display">{{ playbackRate }}x</span>
        </div>
      </div>

      <!-- 音频增益 -->
      <div class="property-group">
        <label>增益 (dB)</label>
        <SliderInput
          :model-value="localConfig.gain || 0"
          :min="-20"
          :max="20"
          :step="0.5"
          @update:model-value="updateGain"
        />
      </div>
    </div>

    <!-- 时间范围控制 -->
    <div class="properties-section">
      <h3>时间范围</h3>

      <div class="property-group">
        <label>开始时间</label>
        <NumberInput
          :model-value="clipStartTime"
          @update:model-value="updateClipStartTime"
          suffix="帧"
        />
      </div>

      <div class="property-group">
        <label>结束时间</label>
        <NumberInput
          :model-value="clipEndTime"
          @update:model-value="updateClipEndTime"
          suffix="帧"
        />
      </div>

      <div class="property-group">
        <label>时长</label>
        <span class="duration-display">
          {{ formatDuration(clipEndTime - clipStartTime) }}
        </span>
      </div>
    </div>


  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import SliderInput from './SliderInput.vue'
import NumberInput from './NumberInput.vue'
import { useVideoStore } from '../stores/videoStore'
import { AudioCommandFactory } from '../stores/modules/commands/audioCommands'
import type { TimelineItem, AudioMediaConfig } from '../types'

interface Props {
  selectedTimelineItem: TimelineItem<'audio'>
  currentFrame: number
}

const props = defineProps<Props>()

const videoStore = useVideoStore()

// 本地配置状态
const localConfig = ref<AudioMediaConfig>({ ...props.selectedTimelineItem.config })

// 计算属性
const playbackRate = computed(() => props.selectedTimelineItem.timeRange.playbackRate)
const clipStartTime = computed(() => props.selectedTimelineItem.timeRange.clipStartTime)
const clipEndTime = computed(() => props.selectedTimelineItem.timeRange.clipEndTime)

// 监听选中项目变化
watch(() => props.selectedTimelineItem, (newItem) => {
  localConfig.value = { ...newItem.config }
}, { deep: true })

// 更新方法
function updateVolume(volume: number) {
  localConfig.value.volume = volume
  executeUpdateCommand({ volume })
}

function toggleMute() {
  localConfig.value.isMuted = !localConfig.value.isMuted
  executeUpdateCommand({ isMuted: localConfig.value.isMuted })
}

function updatePlaybackRate(rate: number) {
  const command = AudioCommandFactory.createUpdatePlaybackRateCommand(
    props.selectedTimelineItem.id,
    rate
  )
  videoStore.executeCommand(command)
}

function updateGain(gain: number) {
  localConfig.value.gain = gain
  executeUpdateCommand({ gain })
}

function updateClipStartTime(startTime: number) {
  const command = AudioCommandFactory.createUpdateTimeRangeCommand(
    props.selectedTimelineItem.id,
    { clipStartTime: startTime }
  )
  videoStore.executeCommand(command)
}

function updateClipEndTime(endTime: number) {
  const command = AudioCommandFactory.createUpdateTimeRangeCommand(
    props.selectedTimelineItem.id,
    { clipEndTime: endTime }
  )
  videoStore.executeCommand(command)
}



function executeUpdateCommand(updates: Partial<AudioMediaConfig>) {
  const command = AudioCommandFactory.createUpdateAudioCommand(
    props.selectedTimelineItem.id,
    updates
  )
  videoStore.executeCommand(command)
}

function formatDuration(frames: number): string {
  // 复用现有的时间格式化逻辑
  return framesToTimecode(frames)
}
</script>

<style scoped>
.audio-clip-properties {
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: var(--border-radius-medium);
}

.properties-section {
  margin-bottom: 20px;
}

.properties-section h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.property-group {
  margin-bottom: 12px;
}

.property-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.volume-control .slider-input {
  flex: 1;
}

.volume-control .number-input {
  width: 60px;
}

.mute-button {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: var(--border-radius-small);
  cursor: pointer;
  transition: all 0.2s ease;
}

.mute-button:hover {
  background: var(--bg-hover);
}

.mute-button.active {
  background: var(--color-danger);
  color: white;
  border-color: var(--color-danger);
}

.speed-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.speed-display {
  min-width: 30px;
  font-size: 12px;
  color: var(--text-secondary);
}

.duration-display {
  font-size: 12px;
  color: var(--text-secondary);
  font-family: monospace;
}


</style>
```

## 10. 命令系统实现

### 10.1 音频命令工厂

```typescript
// 新建 frontend/src/stores/modules/commands/audioCommands.ts

import type { SimpleCommand } from '../commandModule'
import type { AudioMediaConfig, VideoTimeRange, TimelineItem } from '../../../types'
import { generateCommandId } from '../../../utils/idGenerator'

/**
 * 更新音频属性命令
 */
export class UpdateAudioCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private previousConfig: Partial<AudioMediaConfig>

  constructor(
    private timelineItemId: string,
    private newConfig: Partial<AudioMediaConfig>,
    private timelineModule: any
  ) {
    this.id = generateCommandId()
    this.description = `更新音频属性: ${Object.keys(newConfig).join(', ')}`
    this.previousConfig = {}
  }

  async execute(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId) as TimelineItem<'audio'>
    if (!item || item.mediaType !== 'audio') {
      throw new Error('音频项目不存在或类型错误')
    }

    // 保存之前的配置用于撤销
    this.previousConfig = {}
    for (const key in this.newConfig) {
      this.previousConfig[key] = item.config[key]
    }

    const audioSprite = item.sprite

    // 更新音频精灵属性
    if (this.newConfig.volume !== undefined) {
      audioSprite.setVolume(this.newConfig.volume)
    }
    if (this.newConfig.isMuted !== undefined) {
      audioSprite.setMuted(this.newConfig.isMuted)
    }
    if (this.newConfig.gain !== undefined) {
      audioSprite.setGain(this.newConfig.gain)
    }

    // 更新配置对象
    Object.assign(item.config, this.newConfig)
  }

  async undo(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId) as TimelineItem<'audio'>
    if (!item || item.mediaType !== 'audio') return

    const audioSprite = item.sprite

    // 恢复之前的属性
    if (this.previousConfig.volume !== undefined) {
      audioSprite.setVolume(this.previousConfig.volume)
    }
    if (this.previousConfig.isMuted !== undefined) {
      audioSprite.setMuted(this.previousConfig.isMuted)
    }
    if (this.previousConfig.gain !== undefined) {
      audioSprite.setGain(this.previousConfig.gain)
    }

    // 恢复配置对象
    Object.assign(item.config, this.previousConfig)
  }
}

/**
 * 更新音频播放速度命令
 */
export class UpdateAudioPlaybackRateCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private previousRate: number

  constructor(
    private timelineItemId: string,
    private newRate: number,
    private timelineModule: any
  ) {
    this.id = generateCommandId()
    this.description = `更新播放速度: ${newRate}x`
    this.previousRate = 1
  }

  async execute(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId) as TimelineItem<'audio'>
    if (!item || item.mediaType !== 'audio') {
      throw new Error('音频项目不存在或类型错误')
    }

    // 保存之前的播放速度
    this.previousRate = item.timeRange.playbackRate

    // 更新播放速度
    const audioSprite = item.sprite
    audioSprite.setPlaybackRate(this.newRate)

    // 更新时间范围
    item.timeRange.playbackRate = this.newRate
  }

  async undo(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId) as TimelineItem<'audio'>
    if (!item || item.mediaType !== 'audio') return

    // 恢复之前的播放速度
    const audioSprite = item.sprite
    audioSprite.setPlaybackRate(this.previousRate)
    item.timeRange.playbackRate = this.previousRate
  }
}

/**
 * 更新音频时间范围命令
 */
export class UpdateAudioTimeRangeCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private previousTimeRange: Partial<VideoTimeRange>

  constructor(
    private timelineItemId: string,
    private newTimeRange: Partial<VideoTimeRange>,
    private timelineModule: any
  ) {
    this.id = generateCommandId()
    this.description = `更新音频时间范围`
    this.previousTimeRange = {}
  }

  async execute(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId) as TimelineItem<'audio'>
    if (!item || item.mediaType !== 'audio') {
      throw new Error('音频项目不存在或类型错误')
    }

    // 保存之前的时间范围
    this.previousTimeRange = {}
    for (const key in this.newTimeRange) {
      this.previousTimeRange[key] = item.timeRange[key]
    }

    const audioSprite = item.sprite

    // 更新音频精灵时间范围
    if (this.newTimeRange.clipStartTime !== undefined) {
      audioSprite.setClipStartTime(this.newTimeRange.clipStartTime)
    }
    if (this.newTimeRange.clipEndTime !== undefined) {
      audioSprite.setClipEndTime(this.newTimeRange.clipEndTime)
    }
    if (this.newTimeRange.timelineStartTime !== undefined) {
      audioSprite.setTimelineStartTime(this.newTimeRange.timelineStartTime)
    }
    if (this.newTimeRange.timelineEndTime !== undefined) {
      audioSprite.setTimelineEndTime(this.newTimeRange.timelineEndTime)
    }

    // 更新时间范围对象
    Object.assign(item.timeRange, this.newTimeRange)
  }

  async undo(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId) as TimelineItem<'audio'>
    if (!item || item.mediaType !== 'audio') return

    const audioSprite = item.sprite

    // 恢复之前的时间范围
    if (this.previousTimeRange.clipStartTime !== undefined) {
      audioSprite.setClipStartTime(this.previousTimeRange.clipStartTime)
    }
    if (this.previousTimeRange.clipEndTime !== undefined) {
      audioSprite.setClipEndTime(this.previousTimeRange.clipEndTime)
    }
    if (this.previousTimeRange.timelineStartTime !== undefined) {
      audioSprite.setTimelineStartTime(this.previousTimeRange.timelineStartTime)
    }
    if (this.previousTimeRange.timelineEndTime !== undefined) {
      audioSprite.setTimelineEndTime(this.previousTimeRange.timelineEndTime)
    }

    // 恢复时间范围对象
    Object.assign(item.timeRange, this.previousTimeRange)
  }
}

/**
 * 音频命令工厂
 */
export class AudioCommandFactory {
  /**
   * 创建更新音频属性命令
   */
  static createUpdateAudioCommand(
    timelineItemId: string,
    config: Partial<AudioMediaConfig>
  ): UpdateAudioCommand {
    // 这里需要获取timelineModule实例
    // 具体实现取决于你的模块架构
    const timelineModule = null // 需要从适当的地方获取
    return new UpdateAudioCommand(timelineItemId, config, timelineModule)
  }

  /**
   * 创建更新播放速度命令
   */
  static createUpdatePlaybackRateCommand(
    timelineItemId: string,
    rate: number
  ): UpdateAudioPlaybackRateCommand {
    const timelineModule = null // 需要从适当的地方获取
    return new UpdateAudioPlaybackRateCommand(timelineItemId, rate, timelineModule)
  }

  /**
   * 创建更新时间范围命令
   */
  static createUpdateTimeRangeCommand(
    timelineItemId: string,
    timeRange: Partial<VideoTimeRange>
  ): UpdateAudioTimeRangeCommand {
    const timelineModule = null // 需要从适当的地方获取
    return new UpdateAudioTimeRangeCommand(timelineItemId, timeRange, timelineModule)
  }
}
```

## 11. 音频文件创建和管理

### 11.1 音频时间轴项目创建流程

```typescript
// 新建 frontend/src/utils/audioTimelineUtils.ts

import { AudioVisibleSprite } from './AudioVisibleSprite'
import { generateTimelineItemId } from './idGenerator'
import type { TimelineItem, AudioMediaConfig, VideoTimeRange } from '../types'
import { markRaw } from 'vue'

/**
 * 创建音频时间轴项目
 *
 * @param mediaItemId 媒体库项目ID
 * @param startTimeFrames 开始时间（帧数）
 * @param trackId 轨道ID
 * @param duration 时长（帧数，可选）
 * @returns 音频时间轴项目
 */
export async function createAudioTimelineItem(
  mediaItemId: string,
  startTimeFrames: number,
  trackId: string,
  duration?: number
): Promise<TimelineItem<'audio'>> {

  // 1. 获取媒体库项目
  const mediaItem = videoStore.getMediaItem(mediaItemId)
  if (!mediaItem || !mediaItem.audioClip) {
    throw new Error('音频媒体项目不存在或未准备就绪')
  }

  // 2. 创建音频精灵
  const audioSprite = new AudioVisibleSprite(mediaItem.audioClip)

  // 3. 设置时间范围
  const audioDuration = duration || mediaItem.duration
  const endTimeFrames = startTimeFrames + audioDuration

  audioSprite.setClipStartTime(0) // 从音频开始播放
  audioSprite.setClipEndTime(audioDuration) // 播放完整音频
  audioSprite.setTimelineStartTime(startTimeFrames)
  audioSprite.setTimelineEndTime(endTimeFrames)

  // 4. 创建时间轴项目
  const timelineItem: TimelineItem<'audio'> = {
    id: generateTimelineItemId(),
    mediaItemId,
    trackId,
    mediaType: 'audio',
    timeRange: audioSprite.getTimeRange(),
    sprite: markRaw(audioSprite),
    config: {
      // 基础属性
      zIndex: 0,

      // 音频属性
      volume: 1,
      isMuted: false,

      // 音频效果
      gain: 0,
    }
  }

  return timelineItem
}

/**
 * 从现有音频项目复制创建新项目
 * 实现"从源头重建"原则
 */
export async function duplicateAudioTimelineItem(
  originalItem: TimelineItem<'audio'>,
  newStartTime: number,
  newTrackId?: string
): Promise<TimelineItem<'audio'>> {

  // 从原始MediaItem重新创建，确保数据一致性
  const newItem = await createAudioTimelineItem(
    originalItem.mediaItemId,
    newStartTime,
    newTrackId || originalItem.trackId,
    originalItem.timeRange.effectiveDuration
  )

  // 复制所有配置属性
  newItem.config = { ...originalItem.config }

  // 复制时间范围属性
  const originalTimeRange = originalItem.timeRange
  const newSprite = newItem.sprite

  newSprite.setClipStartTime(originalTimeRange.clipStartTime)
  newSprite.setClipEndTime(originalTimeRange.clipEndTime)
  newSprite.setPlaybackRate(originalTimeRange.playbackRate)

  // 应用音频属性到新精灵
  newSprite.setVolume(newItem.config.volume)
  newSprite.setMuted(newItem.config.isMuted)

  return newItem
}

/**
 * 分割音频项目
 * 在指定时间点分割音频clip
 */
export async function splitAudioTimelineItem(
  originalItem: TimelineItem<'audio'>,
  splitTimeFrames: number
): Promise<[TimelineItem<'audio'>, TimelineItem<'audio'>]> {

  const originalTimeRange = originalItem.timeRange

  // 验证分割点
  if (splitTimeFrames <= originalTimeRange.timelineStartTime ||
      splitTimeFrames >= originalTimeRange.timelineEndTime) {
    throw new Error('分割点必须在音频项目的时间范围内')
  }

  // 计算分割后的时间范围
  const splitRelativeTime = splitTimeFrames - originalTimeRange.timelineStartTime
  const clipSplitTime = originalTimeRange.clipStartTime +
    (splitRelativeTime * originalTimeRange.playbackRate)

  // 创建第一部分（开始到分割点）
  const firstPart = await createAudioTimelineItem(
    originalItem.mediaItemId,
    originalTimeRange.timelineStartTime,
    originalItem.trackId,
    splitRelativeTime
  )

  // 设置第一部分的时间范围
  firstPart.sprite.setClipStartTime(originalTimeRange.clipStartTime)
  firstPart.sprite.setClipEndTime(clipSplitTime)
  firstPart.sprite.setPlaybackRate(originalTimeRange.playbackRate)

  // 创建第二部分（分割点到结束）
  const secondPartDuration = originalTimeRange.timelineEndTime - splitTimeFrames
  const secondPart = await createAudioTimelineItem(
    originalItem.mediaItemId,
    splitTimeFrames,
    originalItem.trackId,
    secondPartDuration
  )

  // 设置第二部分的时间范围
  secondPart.sprite.setClipStartTime(clipSplitTime)
  secondPart.sprite.setClipEndTime(originalTimeRange.clipEndTime)
  secondPart.sprite.setPlaybackRate(originalTimeRange.playbackRate)

  // 复制配置到两个部分
  firstPart.config = { ...originalItem.config }
  secondPart.config = { ...originalItem.config }

  // 应用配置到精灵
  [firstPart, secondPart].forEach(part => {
    part.sprite.setVolume(part.config.volume)
    part.sprite.setMuted(part.config.isMuted)
  })

  return [firstPart, secondPart]
}
```

### 11.2 MediaLibrary音频支持扩展

```typescript
// 在 frontend/src/components/MediaLibrary.vue 中扩展

// 音频文件类型检测
function getMediaTypeFromFile(file: File): MediaType {
  const extension = file.name.split('.').pop()?.toLowerCase()

  // 音频格式检测
  const audioExtensions = ['mp3', 'wav', 'aac', 'ogg', 'm4a', 'flac', 'wma']
  if (audioExtensions.includes(extension || '')) {
    return 'audio'
  }

  // 视频格式检测
  const videoExtensions = ['mp4', 'avi', 'mov', 'webm', 'mkv']
  if (videoExtensions.includes(extension || '')) {
    return 'video'
  }

  // 图片格式检测
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
  if (imageExtensions.includes(extension || '')) {
    return 'image'
  }

  return 'video' // 默认
}

// 音频文件处理函数
async function handleAudioFile(file: File): Promise<void> {
  const mediaItemId = generateMediaItemId()

  // 创建解析中状态的MediaItem
  const parsingMediaItem: MediaItem = {
    id: mediaItemId,
    name: file.name,
    file,
    url: URL.createObjectURL(file),
    duration: 0, // 将在解析后更新
    type: file.type,
    mediaType: 'audio',
    mp4Clip: null,
    imgClip: null,
    audioClip: null, // 新增
    isReady: false,
    status: 'parsing',
  }

  console.log(`📋 创建解析中的音频MediaItem: ${parsingMediaItem.name} (ID: ${mediaItemId})`)

  // 先添加解析中状态的素材到store
  videoStore.addMediaItem(parsingMediaItem)

  try {
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
      sampleRate: meta.sampleRate + 'Hz',
      channels: meta.channels + '声道',
    })

    // 更新MediaItem为就绪状态
    const readyMediaItem: MediaItem = {
      ...parsingMediaItem,
      audioClip,
      duration: durationFrames,
      isReady: true,
      status: 'ready',
    }

    videoStore.updateMediaItem(readyMediaItem)
    console.log(`✅ 音频素材解析完成: ${file.name}`)

  } catch (error) {
    console.error(`❌ 音频文件解析失败: ${file.name}`, error)

    // 更新为错误状态
    const errorMediaItem: MediaItem = {
      ...parsingMediaItem,
      status: 'error',
    }

    videoStore.updateMediaItem(errorMediaItem)

    // 显示错误通知
    videoStore.addNotification({
      type: 'error',
      message: `音频文件解析失败: ${file.name}`,
      duration: 5000,
    })
  }
}

// 在文件处理主函数中添加音频处理
async function handleFiles(files: FileList) {
  for (const file of Array.from(files)) {
    const mediaType = getMediaTypeFromFile(file)

    try {
      switch (mediaType) {
        case 'video':
          await handleVideoFile(file)
          break
        case 'image':
          await handleImageFile(file)
          break
        case 'audio':
          await handleAudioFile(file) // 新增
          break
        default:
          console.warn(`不支持的文件类型: ${file.name}`)
      }
    } catch (error) {
      console.error(`文件处理失败: ${file.name}`, error)
    }
  }
}
```

### 11.3 Timeline组件音频集成

```typescript
// 在 frontend/src/components/Timeline.vue 中扩展

// 组件选择逻辑
function getClipComponent(mediaType: MediaType) {
  switch (mediaType) {
    case 'video':
    case 'image':
      return VideoClip
    case 'audio':
      return AudioClip // 新增音频组件
    case 'text':
      return TextClip
    default:
      return VideoClip
  }
}

// 轨道兼容性检查
function isMediaCompatibleWithTrack(mediaType: MediaType, trackType: TrackType): boolean {
  switch (trackType) {
    case 'video':
      return mediaType === 'video' || mediaType === 'image'
    case 'audio':
      // 音频轨道可以接受音频文件和视频文件（提取音频）
      return mediaType === 'audio' || mediaType === 'video'
    case 'text':
      return mediaType === 'text'
    default:
      return false
  }
}

// 拖拽处理扩展
function handleMediaItemDrop(event: DragEvent, trackId: string, timePosition: number) {
  const dragData = getCurrentMediaItemDragData()
  if (!dragData) return

  const track = videoStore.getTrack(trackId)
  if (!track) return

  // 检查媒体类型兼容性
  if (!isMediaCompatibleWithTrack(dragData.mediaType, track.type)) {
    videoStore.addNotification({
      type: 'warning',
      message: `${dragData.mediaType} 类型的媒体不能添加到 ${track.type} 轨道`,
      duration: 3000,
    })
    return
  }

  // 根据媒体类型创建相应的时间轴项目
  switch (dragData.mediaType) {
    case 'video':
      createVideoTimelineItem(dragData.mediaItemId, timePosition, trackId)
      break
    case 'image':
      createImageTimelineItem(dragData.mediaItemId, timePosition, trackId)
      break
    case 'audio':
      createAudioTimelineItem(dragData.mediaItemId, timePosition, trackId) // 新增
      break
    case 'text':
      // 文本不支持拖拽创建
      break
  }
}

// 音频时间轴项目创建
async function createAudioTimelineItem(mediaItemId: string, timePosition: number, trackId: string) {
  try {
    const audioItem = await createAudioTimelineItem(mediaItemId, timePosition, trackId)

    // 使用命令模式添加到时间轴
    const command = new AddTimelineItemCommand(audioItem)
    await videoStore.executeCommand(command)

    console.log('✅ 音频项目已添加到时间轴:', audioItem.id)
  } catch (error) {
    console.error('❌ 创建音频时间轴项目失败:', error)
    videoStore.addNotification({
      type: 'error',
      message: '添加音频项目失败',
      duration: 3000,
    })
  }
}
```

## 12. 性能优化策略

### 12.1 基础性能考虑

**音频解码优化：**
- 限制并发加载的音频文件数量
- 实现音频文件预加载机制
- 优化大音频文件的内存使用

**缓存策略：**
- 缓存已解析的音频元数据
- 实现音频clip的智能缓存
- 避免重复解码相同的音频文件

**渲染优化：**
- 使用requestAnimationFrame优化UI更新
- 实现音频clip的虚拟化渲染
- 优化时间轴滚动性能

## 13. 实际文件结构

```
frontend/src/
├── types/index.ts                    # 🔧 类型定义扩展（AudioMediaConfig，复用VideoTimeRange）
├── components/
│   ├── Timeline.vue                  # 🔧 轨道管理和音频集成（组件选择逻辑）
│   ├── BaseClip.vue                  # ✅ clip基础组件（复用现有功能）
│   ├── TimelineVideoClip.vue         # ✅ 视频/图片clip组件（参考实现）
│   ├── AudioClip.vue                 # 🆕 音频clip组件（基于BaseClip）
│   ├── AudioClipProperties.vue       # 🆕 音频编辑面板（音频属性控制）
│   ├── PropertiesPanel.vue           # 🔧 属性面板（集成AudioClipProperties）
│   ├── MediaLibrary.vue              # 🔧 媒体库（音频文件支持）
│   ├── SliderInput.vue               # ✅ 滑块输入组件（复用）
│   └── NumberInput.vue               # ✅ 数字输入组件（复用）
├── stores/
│   ├── videoStore.ts                 # 🔧 主store（音频轨道管理）
│   └── modules/
│       ├── trackModule.ts            # 🔧 轨道管理模块（支持音频轨道）
│       ├── timelineModule.ts         # ✅ 时间轴管理模块（复用）
│       └── commands/
│           ├── timelineCommands.ts   # ✅ 通用时间轴命令（复用）
│           └── audioCommands.ts      # 🆕 音频专用命令（Update/Add/Remove）
├── utils/
│   ├── AudioVisibleSprite.ts         # 🆕 音频精灵类
│   ├── audioTimelineUtils.ts         # 🆕 音频时间轴工具函数
│   ├── VideoVisibleSprite.ts         # ✅ 视频精灵类（参考实现）
│   ├── BaseVisibleSprite.ts          # ✅ 基础精灵类（复用）
│   └── idGenerator.ts                # ✅ ID生成工具（复用）
├── composables/
│   ├── useWebAVControls.ts           # 🔧 WebAV控制（createAudioClip）
│   └── usePlaybackControls.ts        # ✅ 播放控制（复用）
└── docs/
    ├── audio-track-support-design.md # 🆕 本设计文档
    ├── text-track-support-design.md  # ✅ 文本轨道设计（参考）
    └── base-clip-component-design.md # ✅ BaseClip基础组件设计（参考）
```

**文件状态说明**：
- ✅ **已存在**：文件已存在，可直接复用
- 🔧 **需修改**：现有文件需要扩展以支持音频
- 🆕 **需新建**：需要创建的新文件

## 14. 实施检查清单

### 阶段1：基础音频轨道支持 ✅

#### 技术验证 (2小时)
- [ ] 确认WebAV库是否提供AudioClip类
- [ ] 测试音频文件格式支持（MP3, WAV, AAC等）
- [ ] 验证音频解码和播放能力
- [ ] 制定技术实施方案

#### 类型系统扩展 (2小时)
- [x] 在`types/index.ts`中添加AudioMediaConfig接口
- [x] 扩展MediaItem支持audioClip属性
- [x] 更新CustomSprite类型包含AudioVisibleSprite
- [x] 扩展关键帧属性映射支持音频
- [x] 确认音频复用VideoTimeRange（已删除多余的AudioTimeRange）
- [x] 确保所有类型定义编译通过

#### AudioVisibleSprite实现 (4小时)
- [x] 创建`utils/AudioVisibleSprite.ts`文件
- [x] 实现音频精灵类核心功能
- [x] 复用VideoVisibleSprite的时间控制逻辑
- [x] 实现音频控制方法（音量、静音等）
- [x] 实现音频拦截器进行实时音频处理
- [x] 添加播放速度调整和轨道静音支持

#### 基础AudioClip组件 (3小时)
- [ ] 创建`components/AudioClip.vue`组件
- [ ] 基于BaseClip实现音频clip显示
- [ ] 设计音频clip的视觉样式（橙色渐变）
- [ ] 实现音频信息显示（名称、时长）
- [ ] 添加音量指示器和静音状态显示

#### 轨道系统集成 (3小时)
- [ ] 在`Timeline.vue`中扩展getClipComponent函数
- [ ] 更新isMediaCompatibleWithTrack逻辑
- [ ] 实现音频轨道的拖拽支持
- [ ] 测试音频clip在时间轴中的显示

#### 音频文件导入 (2小时)
- [ ] 在`useWebAVControls.ts`中实现createAudioClip函数
- [ ] 在`MediaLibrary.vue`中扩展音频文件类型检测
- [ ] 实现handleAudioFile函数
- [ ] 测试音频文件导入和解析流程

### 阶段2：音频编辑功能 ✅

#### AudioClipProperties组件 (4小时)
- [ ] 创建`components/AudioClipProperties.vue`组件
- [ ] 实现音量控制（滑块+数字输入+静音按钮）
- [ ] 实现播放速度调整
- [ ] 实现时间范围编辑（开始/结束时间）
- [ ] 添加显示设置（波形开关、颜色选择）

#### 命令系统集成 (3小时)
- [ ] 创建`stores/modules/commands/audioCommands.ts`文件
- [ ] 实现UpdateAudioCommand类
- [ ] 实现UpdateAudioPlaybackRateCommand类
- [ ] 实现UpdateAudioTimeRangeCommand类
- [ ] 创建AudioCommandFactory工厂类

#### 音频剪辑功能 (3小时)
- [ ] 在`audioTimelineUtils.ts`中实现splitAudioTimelineItem函数
- [ ] 实现duplicateAudioTimelineItem函数
- [ ] 集成到现有的剪辑操作流程
- [ ] 测试音频clip的分割和复制功能

#### 属性面板集成 (2小时)
- [ ] 在`PropertiesPanel.vue`中集成AudioClipProperties
- [ ] 根据选中项目类型动态显示音频属性面板
- [ ] 测试音频属性编辑功能
- [ ] 验证撤销重做功能

### 阶段3：高级音频功能 🚀

#### 音频波形显示 (6小时)
- [ ] 实现音频波形数据提取逻辑
- [ ] 在AudioClip组件中添加波形绘制
- [ ] 实现WaveformCacheManager缓存管理器
- [ ] 优化波形渲染性能
- [ ] 添加波形颜色自定义功能

#### 音频效果系统 (8小时)
- [ ] 实现淡入淡出效果
- [ ] 添加音频增益控制
- [ ] 实现音频滤镜效果
- [ ] 添加音频包络控制
- [ ] 集成到AudioClipProperties面板

#### 多轨道音频混音 (4小时)
- [ ] 实现多音频轨道混合逻辑
- [ ] 添加轨道音量平衡控制
- [ ] 实现音频轨道独奏/静音功能
- [ ] 优化多轨道播放性能

#### 性能优化 (2小时)
- [ ] 实现AudioPreloadManager预加载管理器
- [ ] 优化音频解码性能
- [ ] 实现AudioRenderOptimizer渲染优化器
- [ ] 添加音频缓存机制

## 15. 风险评估和缓解策略

### 15.1 技术风险

**风险1：WebAV库音频支持不足**
- **概率：** 中等
- **影响：** 高（可能需要重新设计技术方案）
- **缓解策略：**
  - 优先进行技术验证
  - 准备备选方案（使用MP4Clip处理音频）
  - 考虑集成第三方音频库

**风险2：音频文件格式兼容性问题**
- **概率：** 中等
- **影响：** 中等（部分音频格式无法支持）
- **缓解策略：**
  - 测试主流音频格式支持情况
  - 提供格式转换建议
  - 实现错误处理和用户提示

**风险3：大音频文件性能问题**
- **概率：** 高
- **影响：** 中等（影响用户体验）
- **缓解策略：**
  - 实施预加载和缓存机制
  - 优化音频解码流程
  - 添加文件大小限制和警告

### 15.2 实施风险

**风险4：开发时间超出预期**
- **概率：** 中等
- **影响：** 中等（延迟功能发布）
- **缓解策略：**
  - 采用渐进式开发方式
  - 优先实现核心功能
  - 高级功能可后续迭代

**风险5：与现有系统集成问题**
- **概率：** 低
- **影响：** 高（可能影响现有功能）
- **缓解策略：**
  - 充分复用现有架构
  - 进行全面的回归测试
  - 保持代码向后兼容

## 16. 成功标准

### 16.1 功能标准
- ✅ 用户可以导入常见格式的音频文件
- ✅ 音频文件在媒体库中正确显示和管理
- ✅ 音频可以拖拽到音频轨道并正常播放
- ✅ 音频clip支持基础编辑操作（移动、调整时长、分割）
- ✅ 音频属性可以通过属性面板进行调整
- ✅ 音频操作支持撤销重做功能

### 16.2 性能标准
- ✅ 音频文件导入时间 < 5秒（100MB以内文件）
- ✅ 音频播放延迟 < 100ms
- ✅ 波形渲染时间 < 2秒（10分钟音频）
- ✅ 内存使用增长 < 50%（相比纯视频项目）

### 16.3 用户体验标准
- ✅ 音频操作与视频操作保持一致的交互模式
- ✅ 错误处理友好，提供清晰的错误信息
- ✅ 界面响应流畅，无明显卡顿
- ✅ 学习成本低，用户可以快速上手

## 17. 总结

### 17.1 设计优势

**架构一致性**：
- 🎯 完全复用现有的BaseClip、命令系统、轨道管理等核心架构
- 🔧 遵循"从源头重建"原则，与其他媒体类型保持一致
- 📐 使用相同的类型系统和泛型设计模式
- ⏱️ 复用VideoTimeRange，音频和视频时间范围概念完全相同

**开发效率**：
- ⚡ 大量复用现有组件和逻辑，减少开发工作量
- 📋 参考文本轨道的成功实现经验
- 🛠️ 渐进式开发策略，降低实施风险

**用户体验**：
- 🎨 与现有功能保持一致的交互体验
- 🔊 专业的音频编辑功能
- 📊 直观的音频波形可视化

### 17.2 关键创新点

**音频专用精灵类**：
- 🎵 AudioVisibleSprite专门处理音频逻辑
- 🔊 复用VideoVisibleSprite的成熟时间控制机制
- ⚡ 优化的音频渲染和缓存策略

**性能优化策略**：
- 💾 多层缓存机制（预加载、波形、渲染）
- 🚀 后台渲染和异步处理
- 📈 智能资源管理

**扩展性设计**：
- 🔌 为音频效果和高级功能预留接口
- 🎛️ 模块化的音频处理架构
- 🔄 易于维护和扩展的代码结构

### 17.3 实施建议

**优先级排序**：
1. **技术验证** - 确保WebAV音频能力满足需求
2. **核心功能** - 实现基础的音频导入和播放
3. **编辑功能** - 添加音频属性控制和剪辑功能
4. **高级功能** - 根据用户反馈选择性实现

**质量保证**：
- 🧪 每个阶段都进行充分测试
- 📊 性能基准测试和优化
- 🔄 持续的代码审查和重构

**用户反馈**：
- 👥 早期用户测试和反馈收集
- 📈 数据驱动的功能优化
- 🎯 基于实际使用场景的改进

---

## 18. AudioVisibleSprite 实现总结

### 18.1 实现完成情况

**✅ 已完成的核心功能**：

1. **基础架构**
   - ✅ 继承自 `BaseVisibleSprite`，遵循现有架构模式
   - ✅ 完整的类型系统集成（`CustomSprite`、`CustomVisibleSprite`）
   - ✅ 与现有媒体类型保持一致的接口设计

2. **时间控制系统**
   - ✅ 复用 `VideoTimeRange` 进行时间范围管理
   - ✅ 实现完整的时间轴控制接口（`setClipStartTime`、`setTimelineStartTime` 等）
   - ✅ 支持播放速度调整和时间偏移处理
   - ✅ 精确的帧级别时间控制

3. **音频处理系统**
   - ✅ 创新的 `tickInterceptor` 音频拦截器机制
   - ✅ 实时音频属性控制（音量、静音、增益）
   - ✅ 支持轨道级静音检查和控制
   - ✅ dB到线性音量转换和多声道处理

4. **状态管理**
   - ✅ 完整的音频状态管理（`AudioState`）
   - ✅ 增益控制（-20dB 到 +20dB 范围限制）
   - ✅ 静音状态的层级管理（片段静音 + 轨道静音）

### 18.2 技术创新点

1. **音频拦截器机制**
   - 通过 `tickInterceptor` 实现实时音频处理，避免重建音频clip
   - 支持多声道音频的精确控制
   - 高性能的音频属性实时调整

2. **时间偏移处理**
   - 通过覆写 `preFrame` 和 `render` 方法实现时间偏移
   - 保持与父类的兼容性，同时添加音频特有逻辑

3. **播放速度自动计算**
   - 通过时间范围自动计算播放速度，无需手动设置
   - 确保音频与时间轴的精确同步

### 18.3 下一步工作

**阶段1剩余任务**：
- [ ] 基础AudioClip组件实现
- [ ] 轨道系统集成
- [ ] 音频文件导入功能
- [ ] 测试和验证

**预计完成时间**：剩余12小时（原16小时 - 已完成4小时）

### 18.4 实施建议

1. **优先级**：先完成UI组件和轨道集成，再进行文件导入功能
2. **测试策略**：重点测试音频同步精度和性能表现
3. **扩展性**：当前实现已为音频效果和高级功能预留了接口

---

*AudioVisibleSprite 的成功实现为音频轨道支持奠定了坚实的技术基础。通过创新的音频拦截器机制和完整的时间控制系统，为后续的UI组件和编辑功能提供了强大的底层支持。预计剩余开发时间28小时，可为用户提供专业级的音频编辑能力。*
