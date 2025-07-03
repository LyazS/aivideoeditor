# 音频Clip实现方案设计

## 概述

基于文本clip的成功实现经验，本文档设计了音频clip的完整实现方案。音频clip作为FILE_BASED媒体类型，在架构设计上与文本clip有所不同，但仍然遵循相同的设计模式和最佳实践。

**注意**：本方案暂不包含波形可视化功能，专注于基础音频clip功能的实现。

## 1. 架构设计

### 1.1 与文本clip的对比分析

| 特性 | 文本Clip | 音频Clip |
|------|----------|----------|
| 媒体分类 | GENERATED类型 | FILE_BASED类型 |
| 数据来源 | 用户输入文本 | 音频文件 |
| 时长限制 | 任意设置 | 受原始音频时长限制 |
| 主要属性 | 文本样式、位置 | 音量、静音、音频效果 |
| 更新模式 | 从源头重建 | 直接属性更新 |
| 渲染方式 | Canvas文本渲染 | 音频播放控制 |
| 缓存策略 | 文本渲染结果 | 音频元数据 |

### 1.2 基于BaseClip的设计

**继承BaseClip优势**：
- 复用拖拽、调整时长、选中等通用交互
- 保持与其他clip类型的一致性
- 减少重复代码，提高开发效率

**AudioClip特有功能**：
- 音频信息显示（文件名、时长、格式）
- 音量和静音状态的视觉反馈
- 音频播放控制集成
- 音频效果状态指示

## 2. 类型系统扩展

### 2.1 音频配置完善

```typescript
// 扩展现有的AudioMediaConfig
interface AudioMediaConfig extends BaseMediaProps, AudioMediaProps {
  // 现有基础属性
  volume: number          // 音量（0-1）
  isMuted: boolean       // 静音状态

  // 新增音频特有属性
  gain?: number          // 音频增益（dB，-20到20）
  playbackRate?: number  // 播放速度倍率（0.5-2.0）

  // 音频效果（预留扩展）
  effects?: AudioEffect[]

  // 继承BaseMediaProps的属性
  // - zIndex: number
  // - animation?: AnimationConfig（淡入淡出应该通过动画系统实现）
}

// 音频效果接口（预留）
interface AudioEffect {
  id: string
  type: 'reverb' | 'echo' | 'equalizer' | 'compressor'
  enabled: boolean
  parameters: Record<string, number>
}
```

### 2.2 音频时间范围特性

```typescript
// 音频使用现有的AudioTimeRange，但需要明确约束
interface AudioTimeRange {
  // 在原始音频中的起始位置（帧数）
  sourceStartTime: number
  // 在原始音频中的结束位置（帧数）
  sourceEndTime: number
  // 在时间轴上的起始位置（帧数）
  timelineStartTime: number
  // 在时间轴上的结束位置（帧数）
  timelineEndTime: number
}

// 约束条件：
// 1. sourceEndTime - sourceStartTime <= 原始音频总时长
// 2. timelineEndTime - timelineStartTime = sourceEndTime - sourceStartTime
// 3. sourceStartTime >= 0, sourceEndTime <= 原始音频总时长
```

### 2.3 音频精灵设计

```typescript
// 音频精灵类，继承BaseVisibleSprite（类似VideoVisibleSprite的模式）
export class AudioVisibleSprite extends BaseVisibleSprite {
  private audioClip: AudioClip  // WebAV音频clip
  private timeRange: AudioTimeRange

  // 音频状态（类似VideoVisibleSprite的audioState）
  private audioState: AudioState = {
    volume: 1,
    isMuted: false,
    playbackRate: 1,
    gain: 0
  }

  // 构造函数
  constructor(audioClip: AudioClip) {
    super(audioClip)
    this.#setupAudioInterceptor()
    this.#updateVisibleSpriteTime()
  }

  // 时间管理（类似VideoVisibleSprite）
  setTimelineStartTime(frames: number): void
  setDisplayDuration(frames: number): void
  getTimeRange(): AudioTimeRange

  // 音频属性控制（直接更新，无需重建）
  setVolume(volume: number): void {
    this.audioState.volume = volume
    this.#applyAudioProperties()
  }

  setMuted(muted: boolean): void {
    this.audioState.isMuted = muted
    this.#applyAudioProperties()
  }

  setPlaybackRate(rate: number): void {
    this.audioState.playbackRate = rate
    this.#updateAudioClipProperties()
  }

  setGain(gainDb: number): void {
    this.audioState.gain = gainDb
    this.#applyAudioProperties()
  }

  // 音频效果（预留）
  addEffect(effect: AudioEffect): void
  removeEffect(effectId: string): void

  // 私有方法（类似VideoVisibleSprite的实现）
  #setupAudioInterceptor(): void {
    // 设置音频数据拦截器，应用音量和增益
  }

  #applyAudioProperties(): void {
    // 实时应用音频属性变化
  }

  #updateVisibleSpriteTime(): void {
    // 更新WebAV时间属性
  }

  // 静态工厂方法
  static async create(audioFile: File, config: Partial<AudioMediaConfig>): Promise<AudioVisibleSprite>
}

// 音频状态接口（类似VideoVisibleSprite的AudioState）
interface AudioState {
  volume: number
  isMuted: boolean
  playbackRate: number
  gain: number
}
```

## 3. 组件设计

### 3.1 AudioClip组件

**基于BaseClip的实现**：
```vue
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
      <!-- 音频信息显示区域 -->
      <div class="audio-content">
        <!-- 音频文件信息 -->
        <div class="audio-info">
          <div class="audio-name">{{ audioName }}</div>
          <div class="audio-duration">{{ formatDuration(audioDuration) }}</div>
        </div>
        
        <!-- 音频状态指示器 -->
        <div class="audio-indicators">
          <!-- 音量指示器 -->
          <div v-if="!timelineItem.config.isMuted" class="volume-indicator">
            <div class="volume-bar" :style="volumeBarStyle"></div>
          </div>
          
          <!-- 静音指示器 -->
          <div v-if="timelineItem.config.isMuted" class="muted-indicator">
            🔇
          </div>
          
          <!-- 效果指示器（预留） -->
          <div v-if="hasEffects" class="effects-indicator">
            ✨
          </div>
        </div>
      </div>
    </template>
  </BaseClip>
  
  <!-- Tooltip组件 -->
  <ClipTooltip
    :visible="baseClipRef?.showTooltipFlag || false"
    :title="audioLabel"
    :media-type="'audio'"
    :duration="formatDurationFromFrames(timelineDurationFrames)"
    :position="formatDurationFromFrames(props.timelineItem.timeRange.timelineStartTime)"
    :show-speed="true"
    :mouse-x="baseClipRef?.tooltipMouseX || 0"
    :mouse-y="baseClipRef?.tooltipMouseY || 0"
    :clip-top="baseClipRef?.tooltipClipTop || 0"
  />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { formatDurationFromFrames } from '../stores/utils/timeUtils'
import BaseClip from './BaseClip.vue'
import ClipTooltip from './ClipTooltip.vue'
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
const audioName = computed(() => {
  const mediaItem = videoStore.getMediaItem(props.timelineItem.mediaItemId)
  return mediaItem?.name || '音频文件'
})

const audioDuration = computed(() => {
  const timeRange = props.timelineItem.timeRange
  return timeRange.timelineEndTime - timeRange.timelineStartTime
})

const volumeBarStyle = computed(() => ({
  width: `${props.timelineItem.config.volume * 100}%`
}))

const hasEffects = computed(() => {
  return props.timelineItem.config.effects && props.timelineItem.config.effects.length > 0
})

const audioLabel = computed(() => {
  return audioName.value
})

const timelineDurationFrames = computed(() => {
  const timeRange = props.timelineItem.timeRange
  return timeRange.timelineEndTime - timeRange.timelineStartTime
})
</script>

<style scoped>
.audio-clip {
  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
  color: white;
  min-height: 50px;
}

.audio-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
  padding: 4px 8px;
}

.audio-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.audio-name {
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.audio-duration {
  font-size: 9px;
  opacity: 0.8;
}

.audio-indicators {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}

.volume-indicator {
  width: 30px;
  height: 3px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 1px;
  overflow: hidden;
}

.volume-bar {
  height: 100%;
  background: #fff;
  transition: width 0.2s ease;
}

.muted-indicator,
.effects-indicator {
  font-size: 10px;
  opacity: 0.9;
}

/* 轨道隐藏时的样式 */
.audio-clip.track-hidden {
  opacity: 0.5;
}

/* 选中状态样式 */
.audio-clip.selected {
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.5);
}
</style>
```

### 3.2 AudioClipProperties组件

**音频属性编辑面板**：
```vue
<template>
  <div class="audio-clip-properties">
    <div class="property-section">
      <h3>音频属性</h3>
      
      <!-- 音量控制 -->
      <div class="property-group">
        <label>音量</label>
        <div class="volume-control">
          <SliderInput
            v-model="localVolume"
            :min="0"
            :max="1"
            :step="0.01"
            @change="updateAudioProperties"
          />
          <span class="volume-value">{{ Math.round(localVolume * 100) }}%</span>
        </div>
      </div>
      
      <!-- 静音开关 -->
      <div class="property-group">
        <label>
          <input
            type="checkbox"
            v-model="localMuted"
            @change="updateAudioProperties"
          />
          静音
        </label>
      </div>
      
      <!-- 播放速度 -->
      <div class="property-group">
        <label>播放速度</label>
        <SliderInput
          v-model="localPlaybackRate"
          :min="0.5"
          :max="2.0"
          :step="0.1"
          @change="updateAudioProperties"
        />
        <span class="speed-value">{{ localPlaybackRate }}x</span>
      </div>

      <!-- 音频增益 -->
      <div class="property-group">
        <label>增益 (dB)</label>
        <SliderInput
          v-model="localGain"
          :min="-20"
          :max="20"
          :step="1"
          @change="updateAudioProperties"
        />
        <span class="gain-value">{{ localGain }}dB</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import SliderInput from './SliderInput.vue'
import type { TimelineItem, AudioMediaConfig } from '../types'

interface Props {
  selectedTimelineItem: TimelineItem<'audio'> | null
  currentFrame: number
}

const props = defineProps<Props>()
const videoStore = useVideoStore()

// 本地状态管理
const localVolume = ref(1)
const localMuted = ref(false)
const localPlaybackRate = ref(1)
const localGain = ref(0)

// 监听选中项目变化，同步本地状态
watch(
  () => props.selectedTimelineItem,
  (newItem) => {
    if (newItem && newItem.mediaType === 'audio') {
      const config = newItem.config
      localVolume.value = config.volume
      localMuted.value = config.isMuted
      localPlaybackRate.value = config.playbackRate || 1
      localGain.value = config.gain || 0
    }
  },
  { immediate: true }
)

// 更新音频属性
const updateAudioProperties = async () => {
  if (!props.selectedTimelineItem) {
    return
  }

  try {
    // 导入音频命令
    const { UpdateAudioPropertiesCommand } = await import('../stores/modules/commands/audioCommands')

    // 创建更新命令
    const command = new UpdateAudioPropertiesCommand(
      props.selectedTimelineItem.id,
      {
        volume: localVolume.value,
        isMuted: localMuted.value,
        playbackRate: localPlaybackRate.value,
        gain: localGain.value,
      },
      {
        getTimelineItem: videoStore.getTimelineItem,
      }
    )

    // 执行命令（带历史记录）
    await videoStore.executeCommand(command)

    console.log('✅ [AudioClipProperties] 音频属性更新成功')
  } catch (error) {
    console.error('❌ [AudioClipProperties] 更新音频属性失败:', error)
    videoStore.showError('更新失败', '音频属性更新失败，请重试')
  }
}
</script>

<style scoped>
.audio-clip-properties {
  padding: 16px;
}

.property-section {
  margin-bottom: 24px;
}

.property-section h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.property-group {
  margin-bottom: 12px;
}

.property-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.volume-value,
.speed-value,
.gain-value {
  font-size: 11px;
  color: var(--color-text-secondary);
  min-width: 40px;
}
</style>
```

## 4. 命令系统设计

### 4.1 音频操作命令

```typescript
// 添加音频项目命令
export class AddAudioItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private audioItem: TimelineItem<'audio'> | null = null

  constructor(
    private mediaItemId: string,
    private startTimeFrames: number,
    private trackId: string,
    private duration?: number,
    private timelineModule: any,
    private webavModule: any
  ) {
    this.id = generateCommandId()
    this.description = `添加音频项目`
  }

  async execute(): Promise<void> {
    // 1. 获取媒体库项目
    const mediaItem = this.timelineModule.getMediaItem(this.mediaItemId)
    if (!mediaItem || mediaItem.mediaType !== 'audio') {
      throw new Error(`音频文件不存在: ${this.mediaItemId}`)
    }

    // 2. 创建音频时间轴项目
    this.audioItem = await createAudioTimelineItem(
      this.mediaItemId,
      this.startTimeFrames,
      this.trackId,
      this.duration
    )

    // 3. 添加到时间轴
    this.timelineModule.addTimelineItem(this.audioItem)

    // 4. 添加到WebAV画布
    this.webavModule.addSprite(this.audioItem.sprite)
  }

  async undo(): Promise<void> {
    if (this.audioItem) {
      this.webavModule.removeSprite(this.audioItem.sprite)
      this.timelineModule.removeTimelineItem(this.audioItem.id)
    }
  }
}

// 更新音频属性命令（采用直接属性更新模式，类似视频clip）
export class UpdateAudioPropertiesCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private oldProperties: Partial<AudioMediaConfig> = {}

  constructor(
    private timelineItemId: string,
    private newProperties: Partial<AudioMediaConfig>,
    private timelineModule: any
  ) {
    this.id = generateCommandId()
    this.description = `更新音频属性`
  }

  async execute(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId) as TimelineItem<'audio'>
    if (!item || item.mediaType !== 'audio') {
      throw new Error(`音频项目不存在: ${this.timelineItemId}`)
    }

    // 保存旧属性用于撤销
    this.oldProperties = {
      volume: item.config.volume,
      isMuted: item.config.isMuted,
      playbackRate: item.config.playbackRate,
      gain: item.config.gain,
    }

    // 直接更新配置（无需重建精灵）
    Object.assign(item.config, this.newProperties)

    // 直接更新音频精灵属性（实时生效，类似VideoVisibleSprite）
    const audioSprite = item.sprite as AudioVisibleSprite
    if (this.newProperties.volume !== undefined) {
      audioSprite.setVolume(this.newProperties.volume)
    }
    if (this.newProperties.isMuted !== undefined) {
      audioSprite.setMuted(this.newProperties.isMuted)
    }
    if (this.newProperties.playbackRate !== undefined) {
      audioSprite.setPlaybackRate(this.newProperties.playbackRate)
    }
    if (this.newProperties.gain !== undefined) {
      audioSprite.setGain(this.newProperties.gain)
    }

    console.log('✅ [UpdateAudioPropertiesCommand] 音频属性更新成功（直接更新模式）')
  }

  async undo(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId) as TimelineItem<'audio'>
    if (item) {
      // 直接恢复属性（无需重建精灵）
      Object.assign(item.config, this.oldProperties)

      // 直接恢复音频精灵属性
      const audioSprite = item.sprite as AudioVisibleSprite
      audioSprite.setVolume(this.oldProperties.volume!)
      audioSprite.setMuted(this.oldProperties.isMuted!)
      audioSprite.setPlaybackRate(this.oldProperties.playbackRate || 1)
      audioSprite.setGain(this.oldProperties.gain || 0)

      console.log('↩️ [UpdateAudioPropertiesCommand] 音频属性撤销成功（直接更新模式）')
    }
  }
}
```

### 4.2 音频工具函数

```typescript
// 创建音频时间轴项目
export async function createAudioTimelineItem(
  mediaItemId: string,
  startTimeFrames: number,
  trackId: string,
  duration?: number
): Promise<TimelineItem<'audio'>> {
  
  // 1. 获取媒体库项目
  const mediaItem = getMediaItem(mediaItemId)
  if (!mediaItem || mediaItem.mediaType !== 'audio') {
    throw new Error(`音频文件不存在: ${mediaItemId}`)
  }

  // 2. 计算时长
  const audioDurationFrames = duration || mediaItem.durationFrames
  const maxDuration = mediaItem.durationFrames
  const actualDuration = Math.min(audioDurationFrames, maxDuration)

  // 3. 创建WebAV AudioClip
  const audioClip = new AudioClip(mediaItem.file)
  await audioClip.ready

  // 4. 创建音频精灵（类似VideoVisibleSprite的创建方式）
  const audioSprite = new AudioVisibleSprite(audioClip)

  // 5. 设置时间范围
  audioSprite.setTimelineStartTime(startTimeFrames)
  audioSprite.setDisplayDuration(actualDuration)

  // 6. 设置初始音频属性
  audioSprite.setVolume(1)
  audioSprite.setMuted(false)
  audioSprite.setPlaybackRate(1)
  audioSprite.setGain(0)

  // 7. 创建音频配置
  const audioConfig: AudioMediaConfig = {
    volume: 1,
    isMuted: false,
    playbackRate: 1,
    gain: 0,
    zIndex: 1,
    animation: undefined,
  }

  // 8. 创建时间轴项目
  const timelineItem: TimelineItem<'audio'> = reactive({
    id: generateTimelineItemId(),
    mediaItemId,
    trackId,
    mediaType: 'audio',
    timeRange: audioSprite.getTimeRange(),
    sprite: markRaw(audioSprite),
    thumbnailUrl: undefined, // 音频不需要缩略图
    config: audioConfig
  })

  console.log('✅ [createAudioTimelineItem] 音频时间轴项目创建完成（直接属性更新模式）')
  return timelineItem
}

// 验证音频轨道兼容性
export function isAudioTrackCompatible(trackType: string): boolean {
  return trackType === 'audio'
}

// 获取音频项目显示名称
export function getAudioItemDisplayName(audioItem: TimelineItem<'audio'>, maxLength: number = 20): string {
  const mediaItem = getMediaItem(audioItem.mediaItemId)
  const name = mediaItem?.name || '音频文件'
  return name.length > maxLength ? name.substring(0, maxLength) + '...' : name
}
```

## 5. 实施计划

### 5.1 阶段1：基础音频支持（优先级：高）

**目标**：实现基本的音频clip功能

**任务清单**：
1. ✅ 扩展AudioMediaConfig类型定义
2. ⏳ 实现AudioVisibleSprite类
3. ⏳ 创建AudioClip组件（基于BaseClip）
4. ⏳ 实现基础的添加/删除操作命令
5. ⏳ 集成到时间轴渲染系统

**验收标准**：
- 能够从媒体库拖拽音频文件到时间轴
- 音频clip显示基本信息（文件名、时长）
- 支持拖拽移动和时长调整
- 支持选中和删除操作
- AudioVisibleSprite采用直接属性更新模式

### 5.2 阶段2：音频属性控制（优先级：中）

**目标**：实现音频属性的编辑和控制

**任务清单**：
1. ⏳ 创建AudioClipProperties组件
2. ⏳ 实现音量、静音控制
3. ⏳ 实现播放速度调整
4. ⏳ 实现音频增益控制
5. ⏳ 添加UpdateAudioPropertiesCommand

**验收标准**：
- 选中音频clip时显示属性面板
- 音量调整实时生效（直接属性更新）
- 静音开关正常工作（直接属性更新）
- 播放速度调整正常（直接属性更新）
- 音频增益控制正常（直接属性更新）
- 所有操作支持撤销重做（无重建延迟）

### 5.3 阶段3：高级功能（优先级：低）

**目标**：实现音频效果和高级功能

**任务清单**：
1. ⏳ 音频效果系统架构
2. ⏳ 基础音频效果实现（均衡器、压缩器等）
3. ⏳ 音频分割功能
4. ⏳ 性能优化
5. ⏳ 淡入淡出效果（通过动画系统实现）

## 6. 技术注意事项

### 6.1 时长约束处理

**关键约束**：
- 音频clip的时长不能超过原始音频文件的时长
- 调整时长时需要同时更新sourceStartTime和sourceEndTime
- 拖拽调整时需要实时验证时长限制

### 6.2 WebAV集成

**音频播放控制**：
- 使用WebAV的AudioClip进行音频播放
- 音频属性变化时直接同步到WebAV（类似VideoVisibleSprite）
- 通过音频拦截器实现实时属性应用
- 确保音频同步和性能优化

### 6.3 直接属性更新模式

**设计原理**：
- 音频属性（音量、静音、播放速度、增益）可以实时调整
- 无需重建AudioClip或AudioVisibleSprite
- 类似VideoVisibleSprite的实现方式
- 提供更好的用户体验和性能

### 6.4 内存管理

**资源清理**：
- 音频文件可能较大，需要及时清理不用的资源
- 实施有效的缓存策略
- 避免内存泄漏

## 7. 测试策略

### 7.1 单元测试

- AudioVisibleSprite类的各个方法
- 音频命令的执行和撤销
- 音频工具函数的边界情况

### 7.2 集成测试

- 音频clip与时间轴系统的集成
- 音频播放与WebAV的集成
- 多音频轨道的混音测试

### 7.3 性能测试

- 大音频文件的加载性能
- 多音频clip的播放性能
- 内存使用情况监控

## 8. 更新模式对比总结

### 8.1 各媒体类型的更新模式

| 媒体类型 | 更新模式 | 原因 | 实现方式 | 性能特点 |
|---------|----------|------|----------|----------|
| **文本** | 从源头重建 | 内容变化需要重新渲染ImgClip | `recreateTextSprite()` | 有重建延迟，但必要 |
| **视频** | 直接属性更新 | 音量、速度等可实时调整 | `setVolume()`, `setPlaybackSpeed()` | 实时响应，无延迟 |
| **图片** | 直接属性更新 | 位置、透明度等可实时调整 | 继承BaseVisibleSprite | 实时响应，无延迟 |
| **音频** | **直接属性更新** | 音频属性可实时调整 | 类似VideoVisibleSprite | 实时响应，无延迟 |

### 8.2 音频clip采用直接更新模式的优势

1. **实时响应**：音量、静音等调整立即生效，用户体验更好
2. **性能优化**：避免不必要的AudioClip重建开销
3. **架构一致性**：与VideoVisibleSprite保持相同的更新模式
4. **内存效率**：减少临时对象创建和垃圾回收压力
5. **代码简洁**：无需复杂的重建和替换逻辑

### 8.3 设计原则总结

**选择更新模式的判断标准**：
- **需要重新渲染内容**：采用"从源头重建"（如文本内容变化）
- **属性可以实时调整**：采用"直接属性更新"（如音频、视频属性）
- **用户体验优先**：音频调整应该是实时的，不应该有感知延迟

这个实现方案充分借鉴了文本clip和视频clip的成功经验，确保了架构的一致性和可维护性。通过采用正确的直接属性更新模式，音频clip将提供与视频clip相同的流畅用户体验。通过分阶段实施，可以逐步完善音频clip的功能，同时保证系统的稳定性。
