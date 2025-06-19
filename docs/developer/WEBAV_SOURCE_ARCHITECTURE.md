# WebAV "从源头重建" 架构设计

## 🎯 核心理念

在我们的视频编辑器中，"从源头重建"是一个核心架构原则。这里的"源头"指的是 **MP4Clip 和 ImgClip 对象**，而不是原始的 File 对象。

## 🏗️ 数据层次结构

```
┌─────────────────┐
│   File 对象     │ ← 原始文件（仅用于初始解析）
│   (原始数据)    │
└─────────┬───────┘
          │ 解析（耗时极长，秒级）
          ↓
┌─────────────────┐
│ MP4Clip/ImgClip │ ← 处理源头（存储在 MediaItem 中）
│   (处理源头)    │
└─────────┬───────┘
          │ 克隆（速度极快，毫秒级）
          ↓
┌─────────────────┐
│ VideoVisible    │ ← 渲染实例（用于画布显示）
│ Sprite/Image    │
│ VisibleSprite   │
│   (渲染实例)    │
└─────────────────┘
```

## 🚀 性能对比

### ❌ 从 File 重建（错误方式）
```typescript
// 每次都需要重新解析文件
const response = new Response(file)
const mp4Clip = new MP4Clip(response.body!)
await mp4Clip.ready  // 🐌 耗时：1-10秒（取决于文件大小）
const sprite = new VideoVisibleSprite(mp4Clip)
```

### ✅ 从 MP4Clip 重建（正确方式）
```typescript
// 从已解析的源头快速克隆
const clonedClip = await webAVControls.cloneMP4Clip(mediaItem.mp4Clip)
const sprite = new VideoVisibleSprite(clonedClip)  // ⚡ 耗时：1-10毫秒
```

## 📊 架构优势

### 1. 性能优势
- **初始解析**：只在文件导入时进行一次（1-10秒）
- **后续使用**：所有操作都基于克隆（1-10毫秒）
- **内存效率**：多个 Sprite 共享底层媒体数据

### 2. 架构清晰
- **职责分离**：MP4Clip/ImgClip 负责数据处理，Sprite 负责渲染
- **状态管理**：源头数据稳定，渲染实例可随时重建
- **扩展性强**：便于实现撤销/重做、项目保存等功能

### 3. 开发体验
- **统一接口**：所有 Sprite 创建都通过工厂函数
- **错误处理**：集中的错误处理和类型检查
- **代码复用**：消除重复的创建逻辑

## 🔧 实现细节

### MediaItem 结构
```typescript
interface MediaItem {
  id: string
  name: string
  file: File                    // 原始文件（仅用于初始解析）
  url: string
  duration: number
  type: string
  mediaType: 'video' | 'image'
  mp4Clip: Raw<MP4Clip> | null  // 视频处理源头
  imgClip: Raw<ImgClip> | null  // 图片处理源头
  isReady: boolean              // 源头是否准备就绪
  status: MediaStatus
  thumbnailUrl?: string
}
```

### 工厂函数
```typescript
export async function createSpriteFromMediaItem(
  mediaItem: MediaItem
): Promise<VideoVisibleSprite | ImageVisibleSprite> {
  // 检查源头是否准备就绪
  if (!mediaItem.isReady) {
    throw new Error(`素材尚未解析完成: ${mediaItem.name}`)
  }

  const webAVControls = useWebAVControls()

  if (mediaItem.mediaType === 'video') {
    // 从视频源头快速克隆
    const clonedMP4Clip = await webAVControls.cloneMP4Clip(mediaItem.mp4Clip)
    return new VideoVisibleSprite(clonedMP4Clip)
  } else {
    // 从图片源头快速克隆
    const clonedImgClip = await webAVControls.cloneImgClip(mediaItem.imgClip)
    return new ImageVisibleSprite(clonedImgClip)
  }
}
```

### 备份策略
```typescript
// ✅ 正确：只备份元数据
interface CanvasBackup {
  timelineItems: Array<{
    id: string
    mediaItemId: string        // 指向源头
    trackId: number
    mediaType: 'video' | 'image'
    timeRange: VideoTimeRange | ImageTimeRange
    position: { x: number; y: number }
    size: { width: number; height: number }
    rotation: number
    zIndex: number
    opacity: number
    volume: number
    isMuted: boolean
    thumbnailUrl: string
  }>
  currentTime: number
  isPlaying: boolean
}

// ❌ 错误：备份 WebAV 对象
interface WrongCanvasBackup {
  sprites: Array<{
    sprite: VideoVisibleSprite  // 不应该备份渲染实例
    clip: MP4Clip              // 不应该备份源头对象
  }>
}
```

## 🎯 使用场景

### 1. 拖拽到时间轴
```typescript
// 从源头创建新的渲染实例
const sprite = await createSpriteFromMediaItem(mediaItem)
```

### 2. 复制时间轴项目
```typescript
// 从同一个源头创建另一个渲染实例
const newSprite = await createSpriteFromMediaItem(mediaItem)
```

### 3. 分割视频片段
```typescript
// 从同一个源头创建两个渲染实例
const firstSprite = await createSpriteFromMediaItem(mediaItem)
const secondSprite = await createSpriteFromMediaItem(mediaItem)
```

### 4. 画布重建
```typescript
// 从元数据和源头重建所有渲染实例
for (const itemData of backup.timelineItems) {
  const mediaItem = videoStore.getMediaItem(itemData.mediaItemId)
  const newSprite = await createSpriteFromMediaItem(mediaItem)
  // 恢复属性...
}
```

## 🚫 常见误区

### ❌ 误区1：认为 File 是源头
```typescript
// 错误：每次都从文件重新解析
const mp4Clip = await createMP4ClipFromFile(mediaItem.file)
```

### ❌ 误区2：缓存 Sprite 实例
```typescript
// 错误：Sprite 是渲染实例，不应该缓存
const spriteCache = new Map<string, VideoVisibleSprite>()
```

### ❌ 误区3：备份 WebAV 对象
```typescript
// 错误：备份渲染实例或源头对象
const backup = {
  sprites: timelineItems.map(item => item.sprite)
}
```

## ✅ 最佳实践

1. **MP4Clip/ImgClip 是唯一的源头** - 存储在 MediaItem 中
2. **Sprite 是临时的渲染实例** - 可随时创建和销毁
3. **备份只保存元数据** - 通过 mediaItemId 引用源头
4. **使用工厂函数统一创建** - 避免重复代码
5. **利用 WebAV 的克隆机制** - 获得最佳性能

这种架构设计充分利用了 WebAV 的特性，在保持极高性能的同时提供了清晰的代码结构和强大的扩展能力。
