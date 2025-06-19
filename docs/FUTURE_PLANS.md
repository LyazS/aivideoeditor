# 未来计划文档

## 📋 概述

本文档描述了视频编辑器的两个核心功能计划：
1. **操作记录系统** - 支持撤销/重做操作
2. **项目持久化系统** - 基于后端的轻量级项目保存/恢复

## 🎯 1. 操作记录系统（撤销/重做）

### 1.1 设计理念

采用 **Command Pattern** 结合 **History Stack** 的架构，为所有用户操作提供撤销/重做支持。

**✅ 当前状态**：核心功能已完成，支持所有基础操作的撤销/重做。

### 1.2 批量操作扩展（新增）

**目标**：为复杂的多步骤操作（如自动排列）提供统一的撤销/重做支持。

**设计原则**：
- 向后兼容现有单个操作命令
- 批量操作作为整体进行撤销/重做
- 性能优化：减少重复的状态更新和通知

**核心架构**：
```typescript
abstract class BaseBatchCommand implements SimpleCommand {
  protected subCommands: SimpleCommand[] = []

  async execute(): Promise<void> {
    for (const command of this.subCommands) {
      await command.execute()
    }
  }

  async undo(): Promise<void> {
    // 逆序撤销所有子命令
    for (let i = this.subCommands.length - 1; i >= 0; i--) {
      await this.subCommands[i].undo()
    }
  }
}
```

**实现计划**：
1. **阶段1**：实现基础批量架构和自动排列命令
2. **阶段2**：添加批量删除功能
3. **阶段3**：扩展到其他批量操作类型

### 1.3 核心接口设计

```typescript
// 命令接口
interface Command {
  id: string
  type: string
  description: string
  timestamp: number
  execute(): Promise<void>
  undo(): Promise<void>
  canMerge?(other: Command): boolean
  merge?(other: Command): Command
}

// 历史管理器
interface HistoryManager {
  commands: Command[]
  currentIndex: number
  maxHistorySize: number
  
  executeCommand(command: Command): Promise<void>
  undo(): Promise<boolean>
  redo(): Promise<boolean>
  canUndo(): boolean
  canRedo(): boolean
  clear(): void
  getHistory(): HistoryEntry[]
}

// 历史条目
interface HistoryEntry {
  id: string
  description: string
  timestamp: number
  canUndo: boolean
}
```

### 1.3 支持的操作类型

#### 时间轴操作
- `AddTimelineItemCommand` - 添加时间轴项目
- `RemoveTimelineItemCommand` - 删除时间轴项目
- `MoveTimelineItemCommand` - 移动时间轴项目位置
- `SplitTimelineItemCommand` - 分割视频片段
- `MergeTimelineItemCommand` - 合并视频片段
- `DuplicateTimelineItemCommand` - 复制时间轴项目
- `ResizeTimelineItemCommand` - 调整时间轴项目时间范围

#### 属性变更操作
- `UpdateTransformCommand` - 变换属性（位置、大小、旋转、透明度）
- `UpdatePlaybackSpeedCommand` - 播放速度调整
- `UpdateTimeRangeCommand` - 时间范围调整

#### 轨道操作
- `AddTrackCommand` - 添加轨道
- `RemoveTrackCommand` - 删除轨道
- `RenameTrackCommand` - 重命名轨道
- `ToggleTrackVisibilityCommand` - 切换轨道可见性
- `ToggleTrackMuteCommand` - 切换轨道静音状态
- `AutoArrangeTrackCommand` - 单轨道自动排列

#### 素材操作
- `AddMediaItemCommand` - 添加素材
- `RemoveMediaItemCommand` - 删除素材
- `RenameMediaItemCommand` - 重命名素材

#### 批量操作（新增）
- `AutoArrangeTrackCommand` - 自动排列轨道上的所有项目
- `BatchDeleteCommand` - 批量删除选中的时间轴项目
- `BatchTransformCommand` - 批量修改多个项目的属性
- `BatchTrackOperationCommand` - 批量轨道操作（添加/删除多个轨道）

**批量操作特点**：
- 作为单个历史记录条目，支持一键撤销/重做
- 内部包含多个子命令，按顺序执行
- 执行期间暂停UI更新，完成后统一刷新
- 提供批量操作的进度反馈和结果通知

### 1.4 命令合并策略

```typescript
// 连续的相同类型操作可以合并
class UpdateTransformCommand implements Command {
  canMerge(other: Command): boolean {
    return other instanceof UpdateTransformCommand &&
           other.targetId === this.targetId &&
           (other.timestamp - this.timestamp) < 1000 // 1秒内的操作
  }
  
  merge(other: UpdateTransformCommand): Command {
    return new UpdateTransformCommand({
      ...this.data,
      finalTransform: other.data.finalTransform
    })
  }
}
```

### 1.5 实施计划

#### 阶段1：基础框架（1-2周）✅ 已完成
- [x] 创建 `historyModule.ts`
- [x] 实现 Command 接口和 HistoryManager
- [x] 添加基础的撤销/重做UI控件

#### 阶段2：核心操作支持（2-3周）✅ 已完成
- [x] 包装现有的时间轴操作为Command
- [x] 实现属性变更的Command
- [x] 添加命令合并逻辑

#### 阶段3：完整功能（1-2周）✅ 已完成
- [x] 支持所有操作类型
- [x] 添加历史面板UI
- [x] 性能优化和内存管理

#### 阶段4：批量操作扩展（1-2周）✅ 已完成
- [x] 实现 `BaseBatchCommand` 基类
- [x] 创建 `BatchBuilder` 构建器
- [x] 扩展 `SimpleHistoryManager` 支持批量命令
- [x] 实现 `BatchAutoArrangeTrackCommand` 批量命令
- [x] 添加批量删除功能
- [x] 性能优化：暂停/恢复UI更新机制

### 1.6 素材删除的影响处理

当素材被删除时，相关操作记录的处理策略：

```typescript
// 1. 删除素材前的预警机制
function removeMediaItem(mediaItemId: string): void {
  const relatedCommands = historyManager.findCommandsByMediaItem(mediaItemId)

  if (relatedCommands.length > 0) {
    const confirmed = confirm(
      `删除此素材将导致 ${relatedCommands.length} 个操作记录失效，确定要删除吗？`
    )
    if (!confirmed) return
  }

  doRemoveMediaItem(mediaItemId)
}

// 2. 操作记录的依赖检测
class Command {
  async execute(): Promise<void> {
    if (!this.validateDependencies()) {
      throw new Error('相关素材已被删除，无法执行此操作')
    }
    await this.doExecute()
  }

  async undo(): Promise<void> {
    if (!this.validateDependencies()) {
      throw new Error('相关素材已被删除，无法撤销此操作')
    }
    await this.doUndo()
  }

  private validateDependencies(): boolean {
    const mediaItem = videoStore.getMediaItem(this.mediaItemId)
    return mediaItem && mediaItem.status !== 'missing'
  }
}

// 3. 历史管理器的简化处理
class HistoryManager {
  async undo(): Promise<boolean> {
    const command = this.getCurrentCommand()

    try {
      await command.undo()
      this.currentIndex--
      return true
    } catch (error) {
      // 简单提示，不提供复杂修复选项
      this.showToast({
        type: 'warning',
        message: `无法撤销"${command.description}"：${error.message}`
      })
      return false
    }
  }

  canUndo(): boolean {
    const command = this.getCurrentCommand()
    return command && command.validateDependencies()
  }

  canRedo(): boolean {
    const command = this.getNextCommand()
    return command && command.validateDependencies()
  }
}
```

**处理原则**：
- ✅ **预防为主**：删除素材前警告用户影响范围
- ✅ **简单检测**：操作执行前验证依赖是否存在
- ✅ **直接提示**：失效操作给出清晰提示信息
- ✅ **自然失效**：UI按钮状态自动反映操作可用性

## 🗄️ 2. 项目持久化系统

### 2.1 设计理念

采用 **轻量级元数据** 存储方案：
- 后端存储原始素材文件
- 项目文件只保存可序列化的元数据
- 加载时重建WebAV对象

### 2.2 数据结构设计

```typescript
interface ProjectMetadata {
  // 项目基本信息
  projectInfo: {
    id: string
    name: string
    version: string
    createdAt: string
    updatedAt: string
  }
  
  // 项目配置
  config: {
    videoResolution: VideoResolution
    frameRate: number
    timelineDuration: number
    proportionalScale: boolean
  }
  
  // 素材引用（不包含File对象和WebAV对象）
  mediaReferences: Array<{
    id: string
    name: string
    backendFileId: string  // 后端文件ID
    duration: number
    mediaType: 'video' | 'image'
    originalFileName: string
    fileSize: number
    checksum?: string  // 文件完整性校验
  }>
  
  // 轨道配置
  tracks: Array<{
    id: number
    name: string
    isVisible: boolean
    isMuted: boolean
    height: number
  }>
  
  // 时间轴布局（核心数据）
  timeline: Array<{
    id: string
    mediaItemId: string  // 引用mediaReferences中的ID
    trackId: number
    mediaType: 'video' | 'image'
    
    // 时间范围
    timeRange: {
      timelineStartTime: number
      timelineEndTime: number
      clipStartTime?: number  // 视频才有
      clipEndTime?: number    // 视频才有
      playbackSpeed?: number  // 视频才有，默认1.0
    }
    
    // 变换属性
    transform: {
      position: { x: number; y: number }
      size: { width: number; height: number }
      rotation: number
      opacity: number
      zIndex: number
    }
  }>
}
```

### 2.3 后端API设计

```typescript
// 文件管理API
interface FileAPI {
  // 上传文件，返回后端文件ID
  uploadFile(file: File): Promise<{
    fileId: string
    url: string
    metadata: FileMetadata
  }>
  
  // 获取文件访问URL
  getFileUrl(fileId: string): Promise<string>
  
  // 获取文件元数据
  getFileMetadata(fileId: string): Promise<FileMetadata>
  
  // 删除文件
  deleteFile(fileId: string): Promise<void>
  
  // 生成代理视频（低清版本）
  generateProxy(fileId: string, quality: 'low' | 'medium'): Promise<{
    proxyFileId: string
    status: 'processing' | 'ready' | 'error'
  }>
}

// 项目管理API
interface ProjectAPI {
  // 创建项目
  createProject(metadata: ProjectMetadata): Promise<{ projectId: string }>
  
  // 获取项目
  getProject(projectId: string): Promise<ProjectMetadata>
  
  // 更新项目
  updateProject(projectId: string, metadata: ProjectMetadata): Promise<void>
  
  // 删除项目
  deleteProject(projectId: string): Promise<void>
  
  // 获取项目列表
  listProjects(): Promise<Array<{
    id: string
    name: string
    updatedAt: string
    thumbnail?: string
  }>>
}
```

### 2.4 项目恢复流程

```typescript
async function loadProject(projectId: string): Promise<void> {
  // 1. 获取项目元数据
  const metadata = await projectAPI.getProject(projectId)
  
  // 2. 验证数据完整性
  const validation = await validateProjectData(metadata)
  if (!validation.isValid) {
    throw new Error(`项目数据不完整: ${validation.errors.join(', ')}`)
  }
  
  // 3. 重建MediaItems
  const mediaItems: MediaItem[] = []
  for (const mediaRef of metadata.mediaReferences) {
    try {
      const fileUrl = await fileAPI.getFileUrl(mediaRef.backendFileId)
      const response = await fetch(fileUrl)
      const file = new File([await response.blob()], mediaRef.originalFileName)
      
      // 创建WebAV对象
      let mp4Clip = null, imgClip = null
      if (mediaRef.mediaType === 'video') {
        mp4Clip = await webAVControls.createMP4Clip(file)
      } else {
        imgClip = await webAVControls.createImgClip(file)
      }
      
      mediaItems.push({
        id: mediaRef.id,
        name: mediaRef.name,
        file,
        url: fileUrl,
        duration: mediaRef.duration,
        type: file.type,
        mediaType: mediaRef.mediaType,
        mp4Clip,
        imgClip,
        isReady: true,
        status: 'ready'
      })
    } catch (error) {
      console.error(`无法加载素材 ${mediaRef.name}:`, error)
      // 创建占位符MediaItem
      mediaItems.push(createMissingMediaItem(mediaRef))
    }
  }
  
  // 4. 重建TimelineItems
  const timelineItems: TimelineItem[] = []
  for (const timelineData of metadata.timeline) {
    const mediaItem = mediaItems.find(m => m.id === timelineData.mediaItemId)
    if (!mediaItem || mediaItem.status === 'missing') {
      continue // 跳过丢失的素材
    }
    
    // 创建Sprite
    const sprite = await createSpriteFromTimelineData(mediaItem, timelineData)
    
    timelineItems.push({
      id: timelineData.id,
      mediaItemId: timelineData.mediaItemId,
      trackId: timelineData.trackId,
      mediaType: timelineData.mediaType,
      timeRange: timelineData.timeRange,
      sprite: markRaw(sprite),
      position: timelineData.transform.position,
      size: timelineData.transform.size,
      rotation: timelineData.transform.rotation,
      opacity: timelineData.transform.opacity,
      zIndex: timelineData.transform.zIndex
    })
  }
  
  // 5. 恢复项目状态
  videoStore.loadProjectData({
    mediaItems,
    timelineItems,
    tracks: metadata.tracks,
    config: metadata.config
  })
  
  console.log(`✅ 项目 "${metadata.projectInfo.name}" 加载完成`)
}
```

### 2.5 增量保存策略

```typescript
// 只在关键操作后触发保存
const autoSaveOperations = [
  'addTimelineItem',
  'removeTimelineItem',
  'updateTransform',
  'splitTimelineItem',
  'updatePlaybackSpeed',
  'addTrack',
  'removeTrack',
  'renameTrack'
]

// 防抖保存，避免频繁网络请求
const debouncedSave = debounce(async () => {
  const metadata = serializeProjectMetadata()
  await projectAPI.updateProject(currentProjectId, metadata)
}, 2000) // 2秒延迟
```

### 2.6 实施计划

#### 阶段1：本地序列化（1-2周）
- [ ] 实现ProjectMetadata的序列化/反序列化
- [ ] 创建 `projectModule.ts`
- [ ] 测试本地项目保存/加载

#### 阶段2：后端集成（2-3周）
- [ ] 设计并实现后端API
- [ ] 添加文件上传和管理功能
- [ ] 实现云端项目保存/加载

#### 阶段3：完整功能（2-3周）
- [ ] 添加项目管理UI
- [ ] 实现增量保存和冲突处理
- [ ] 添加数据完整性验证
- [ ] 支持代理视频功能

## 🔗 3. 系统集成

### 3.1 操作记录与项目保存的结合

```typescript
// 每个Command执行后自动触发项目保存
class BaseCommand implements Command {
  async execute(): Promise<void> {
    await this.doExecute()
    // 触发增量保存
    projectManager.scheduleAutoSave()
  }
  
  async undo(): Promise<void> {
    await this.doUndo()
    // 触发增量保存
    projectManager.scheduleAutoSave()
  }
}
```

### 3.2 数据一致性保证

- 操作记录系统确保状态变更的原子性
- 项目保存前验证数据完整性
- 加载时处理数据丢失和版本兼容性

### 3.3 性能优化策略

- 懒加载：按需重建WebAV对象
- 缓存机制：避免重复下载相同文件
- 内存管理：限制操作历史大小
- 增量更新：只同步变更部分

## 📈 4. 预期收益

### 4.1 用户体验提升
- ✅ 支持撤销/重做，降低操作风险
- ✅ 项目云端保存，支持多设备协作
- ✅ 快速项目恢复，提高工作效率

### 4.2 技术架构优化
- ✅ 轻量级数据存储，降低网络开销
- ✅ 清晰的状态管理，便于维护和扩展
- ✅ 模块化设计，支持功能独立开发

### 4.3 商业价值
- ✅ 专业级功能，提升产品竞争力
- ✅ 云端存储，支持订阅模式
- ✅ 协作功能，扩大用户群体

## 🚀 5. 总体时间规划

| 阶段 | 功能 | 预计时间 | 优先级 | 状态 |
|------|------|----------|--------|------|
| 1 | 操作记录基础框架 | 1-2周 | 高 | ✅ 已完成 |
| 2 | 操作记录完整功能 | 2-3周 | 高 | ✅ 已完成 |
| 3 | 批量操作扩展 | 1-2周 | 高 | ✅ 已完成 |
| 4 | 时间轴多选功能 | 1周 | 高 | 🚧 进行中 |
| 5 | 本地项目序列化 | 1-2周 | 中 | 📋 待开始 |
| 6 | 后端API开发 | 2-3周 | 中 | 📋 待开始 |
| 7 | 云端项目管理 | 2-3周 | 中 | 📋 待开始 |
| 8 | 代理视频功能 | 2-4周 | 低 | 📋 待开始 |

**当前进度**：操作记录系统核心功能已完成，正在规划时间轴多选功能

**下一步重点**：
1. **时间轴多选功能**（1周）- 实现Ctrl+点击多选交互和批量操作UI
2. **本地项目序列化**（1-2周）- 实现项目的本地保存和加载功能

**总计：12-20周**

建议优先完成时间轴多选功能，因为这是用户体验的重要提升，且能充分利用现有的批量操作基础设施。

## 🎯 6. 时间轴多选功能

### 6.1 设计理念

实现基于Ctrl+点击的多选交互，充分利用现有的批量操作基础设施，提供直观的多选体验。

**核心原则**：
- 按住Ctrl进入多选模式
- 单选时保持现有逻辑（AVCanvas同步）
- 多选时取消AVCanvas选中状态
- 属性面板多选时显示占位内容

### 6.2 状态管理设计

#### 选择状态扩展
```typescript
// 在 selectionModule.ts 中新增
const selectedTimelineItemIds = ref<Set<string>>(new Set()) // 多选项目ID集合
const isMultiSelectMode = computed(() => selectedTimelineItemIds.value.size > 1)

// 多选管理方法
function addToMultiSelection(timelineItemId: string): void
function removeFromMultiSelection(timelineItemId: string): void
function toggleMultiSelection(timelineItemId: string): void
function clearMultiSelection(): void
function isInMultiSelection(timelineItemId: string): boolean
```

#### 交互逻辑
```typescript
// VideoClip.vue 点击处理
function selectClip(event: MouseEvent) {
  if (event.ctrlKey) {
    // Ctrl+点击：多选模式
    if (videoStore.isInMultiSelection(props.timelineItem.id)) {
      videoStore.removeFromMultiSelection(props.timelineItem.id)
    } else {
      // 确保当前单选项也加入多选
      if (videoStore.selectedTimelineItemId &&
          !videoStore.isInMultiSelection(videoStore.selectedTimelineItemId)) {
        videoStore.addToMultiSelection(videoStore.selectedTimelineItemId)
      }
      videoStore.addToMultiSelection(props.timelineItem.id)
    }
  } else {
    // 普通点击：单选模式
    videoStore.clearMultiSelection()
    videoStore.selectTimelineItem(props.timelineItem.id)
  }
}
```

### 6.3 视觉反馈设计

#### CSS样式层次
```scss
.video-clip {
  &.selected {
    // 单选样式（现有）
    border: 2px solid #409eff;
  }

  &.multi-selected {
    // 多选样式
    border: 2px solid #67c23a;
    box-shadow: 0 0 6px rgba(103, 194, 58, 0.3);
  }

  &.multi-selected-primary {
    // 多选中的最后选择项（主选项）
    border: 2px solid #409eff;
    box-shadow: 0 0 8px rgba(64, 158, 255, 0.4);
  }
}
```

#### 状态同步策略
- **单选模式**：`selectedTimelineItemId` 为主，`selectedTimelineItemIds` 为空
- **多选模式**：`selectedTimelineItemIds` 为主，`selectedTimelineItemId` 指向最后选择的项目
- **模式切换**：普通点击清空多选，Ctrl+点击进入多选

### 6.4 属性面板适配

#### 多选状态显示
```vue
<template>
  <div class="properties-panel">
    <!-- 多选状态 -->
    <div v-if="multiSelectInfo" class="multi-select-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
      </svg>
      <p>已选择 {{ multiSelectInfo.count }} 个片段</p>
      <p class="hint">批量操作功能开发中...</p>

      <!-- 选中项目列表 -->
      <div class="selected-items-list">
        <div v-for="item in multiSelectInfo.items" :key="item.id" class="selected-item">
          <span class="item-name">
            {{ videoStore.getMediaItem(item.mediaItemId)?.name || '未知素材' }}
          </span>
          <span class="item-type">{{ item.mediaType === 'video' ? '视频' : '图片' }}</span>
        </div>
      </div>
    </div>

    <!-- 单选状态（现有内容保持不变） -->
    <div v-else-if="selectedTimelineItem" class="properties-content">
      <!-- 现有的属性编辑内容 -->
    </div>

    <!-- 无选择状态 -->
    <div v-else class="empty-state">
      <!-- 现有的空状态内容 -->
    </div>
  </div>
</template>
```

### 6.5 批量操作集成

#### 工具栏按钮适配
```typescript
// ClipManagementToolbar.vue
const canDelete = computed(() => {
  return videoStore.selectedTimelineItemId || videoStore.isMultiSelectMode
})

const deleteButtonText = computed(() => {
  if (videoStore.isMultiSelectMode) {
    return `删除选中项目 (${videoStore.selectedTimelineItemIds.size})`
  }
  return '删除选中项目'
})

async function deleteSelectedClip() {
  if (videoStore.isMultiSelectMode) {
    // 批量删除
    const itemIds = Array.from(videoStore.selectedTimelineItemIds)
    const success = await videoStore.batchDeleteTimelineItems(itemIds)
    if (success) {
      videoStore.clearMultiSelection()
    }
  } else if (videoStore.selectedTimelineItemId) {
    // 单个删除
    await videoStore.removeTimelineItemWithHistory(videoStore.selectedTimelineItemId)
  }
}
```

### 6.6 实施计划

#### 阶段1：核心功能（3-4天）
- [ ] 扩展 `selectionModule` 多选状态管理
- [ ] 修改 `VideoClip` 点击处理逻辑
- [ ] 添加多选视觉样式
- [ ] 修改 `PropertiesPanel` 多选占位显示

#### 阶段2：功能完善（2-3天）
- [ ] 集成批量删除到工具栏
- [ ] 空白区域点击清除多选
- [ ] 键盘快捷键支持（Escape清除选择）
- [ ] 多选状态的边界情况处理

#### 阶段3：用户体验优化（1-2天）
- [ ] 多选操作提示和反馈
- [ ] 性能优化（大量选择时）
- [ ] 测试和bug修复

**总计：1周**

### 6.7 技术优势

1. **充分利用现有基础设施**：
   - 复用已实现的批量删除功能
   - 利用现有的操作历史系统
   - 保持与现有选择逻辑的兼容性

2. **渐进式增强**：
   - 不破坏现有单选功能
   - 可独立开发和测试
   - 为未来批量操作功能奠定基础

3. **用户体验优先**：
   - 直观的Ctrl+点击交互
   - 清晰的视觉反馈
   - 合理的状态转换逻辑

### 6.8 未来扩展

多选功能完成后，可以基于此架构扩展：
- 框选多选功能
- 批量属性编辑
- 批量变换操作
- 多选拖拽移动
