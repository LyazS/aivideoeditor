# File System Access API 持久化方案设计

## 1. 概述

本文档描述了基于File System Access API的持久化方案设计，用于实现视频编辑器项目的本地文件存储和项目管理功能。该方案允许用户在首次访问时选择一个本地文件夹，并持久化保持对该文件夹的访问权限。

**核心设计原则：**
- **从源头重建**：WebAV Clip 对象不持久化，每次从原始文件重新创建
- **业务数据分离**：项目配置、时间轴数据与媒体文件分离存储
- **增量同步**：浏览器与本地文件的双向同步机制
- **完整性保证**：文件校验和一致性检查

## 2. 持久化流程设计

### 2.1 浏览器到本地持久化流程

```
用户上传媒体 → WebAV解析 → 生成元数据 → 保存到本地项目目录
                ↓
            同时保存.meta文件 → 更新项目JSON → 触发自动保存
```

### 2.2 本地到浏览器加载流程

```
加载项目JSON → 创建轨道结构 → 加载本地媒体文件 → 重建WebAV Clips → 恢复时间轴项目
```

### 2.3 数据存储结构

```
用户选择的项目根目录/
├── projects/                    # 项目文件夹
│   ├── project-1/
│   │   ├── project.json        # 项目配置和时间轴数据
│   │   ├── media/              # 项目媒体文件
│   │   │   ├── video_001.mp4
│   │   │   ├── video_001.mp4.meta  # 媒体元数据文件
│   │   │   ├── image_001.jpg
│   │   │   ├── image_001.jpg.meta
│   │   │   └── thumbnails/     # 缩略图缓存
│   │   └── exports/            # 导出文件
│   └── project-2/
├── settings/                    # 全局设置
│   ├── app-config.json         # 应用配置
│   └── recent-projects.json    # 最近项目列表
└── cache/                      # 缓存文件
    └── temp/                   # 临时文件
```

## 3. 核心模块设计

### 3.1 DirectoryManager (目录访问管理)

**职责：**
- 首次启动时引导用户选择工作目录
- 管理目录访问权限的持久化
- 提供目录权限验证和重新授权机制

**核心功能：**
- `requestWorkspaceDirectory()` - 请求用户选择工作目录
- `verifyDirectoryAccess()` - 验证目录访问权限
- `persistDirectoryHandle()` - 持久化目录句柄到IndexedDB
- `restoreDirectoryHandle()` - 从IndexedDB恢复目录句柄
- `recheckPermissions()` - 重新检查和请求权限

### 3.2 ProjectManager (项目文件管理)

**职责：**
- 项目的创建、保存、加载、删除
- 项目元数据管理
- 项目列表维护

**核心功能：**
- `createProject(name, template?)` - 创建新项目
- `saveProject(projectData)` - 保存项目数据
- `loadProject(projectId)` - 加载项目（分阶段加载优化）
- `listProjects()` - 获取项目列表
- `deleteProject(projectId)` - 删除项目
- `exportProject(projectId, format)` - 导出项目

### 3.3 MediaManager (媒体文件管理)

**职责：**
- 媒体文件的导入、存储、管理
- 媒体元数据文件(.meta)管理
- 文件完整性校验和同步

**核心功能：**
- `importMediaFiles(files, projectId)` - 导入媒体文件并生成.meta文件
- `saveMediaToProject(file, projectId)` - 保存媒体文件到项目目录
- `loadMediaFromProject(mediaId, projectId)` - 从本地加载媒体文件
- `generateMediaMetadata(file)` - 生成媒体元数据文件
- `verifyMediaIntegrity(mediaId, projectId)` - 验证媒体文件完整性
- `syncMediaFiles(projectId)` - 同步浏览器与本地媒体文件
- `rebuildWebAVClips(mediaReferences)` - 从本地文件重建WebAV Clips

### 3.4 SyncManager (同步管理)

**职责：**
- 浏览器与本地文件的双向同步
- 冲突检测和解决
- 增量同步优化

**核心功能：**
- `checkSyncState(projectId)` - 检查同步状态
- `syncBrowserToLocal(projectId)` - 浏览器数据同步到本地
- `syncLocalToBrowser(projectId)` - 本地数据同步到浏览器
- `detectConflicts(projectId)` - 检测同步冲突
- `resolveConflicts(conflicts, strategy)` - 解决同步冲突
- `autoSave(projectData)` - 自动保存机制（防抖+节流）

## 4. 数据持久化原则

### 4.1 应该持久化的数据

**业务逻辑数据**：
- 媒体文件基本信息（id, name, type, mediaType, duration）
- 时间轴项目配置（timeRange, config, mediaItemId引用）
- 轨道信息（tracks）
- 项目设置（videoResolution, frameRate, timelineDurationFrames）
- 媒体文件引用映射（mediaReferences）

**原则**：只保存重建项目状态所必需的最小数据集

### 4.2 不应该持久化的数据

**运行时状态**：
- `isReady` - WebAV Clip解析状态，重新加载时会重新解析
- `status` - 媒体项目状态（'parsing' | 'ready' | 'error' | 'missing'）
- `thumbnailUrl` - 临时blob URL，重新加载时会重新生成
- `mp4Clip/imgClip/audioClip` - WebAV对象，从源头重建
- `sprite` - 时间轴精灵对象，重新创建

**原则**：任何可以从持久化数据重新计算或生成的状态都不应该保存

### 4.3 重建策略

加载项目时的重建顺序：
1. **加载项目配置** → 恢复基本设置
2. **创建轨道结构** → 重建tracks
3. **加载媒体文件** → 从本地文件重新创建WebAV Clips
4. **重建时间轴项目** → 创建sprites和timelineItems
5. **生成运行时状态** → 重新生成thumbnails等

## 5. 数据结构设计

### 5.1 项目配置文件 (project.json)

```typescript
interface ProjectConfig {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  version: string

  // 项目设置
  settings: {
    videoResolution: VideoResolution
    frameRate: number
    timelineDurationFrames: number
  }

  // 时间轴数据（不包含WebAV Clip对象和运行时状态）
  timeline: {
    tracks: Track[]
    timelineItems: TimelineItemData[] // 包含mediaItemId引用，不包含thumbnailUrl
    mediaItems: MediaItemData[] // 业务数据，不包含WebAV Clip、isReady、status、thumbnailUrl
  }

  // 媒体文件引用映射
  mediaReferences: {
    [mediaId: string]: {
      originalFileName: string
      storedPath: string // 相对于项目目录的路径
      type: MediaType // 'video' | 'image' | 'audio'
      fileSize: number
      checksum: string
    }
  }

  // 导出历史
  exports: ExportRecord[]
}
```

### 5.2 媒体元数据文件 (.meta)

```typescript
interface MediaMetadata {
  // 基础信息
  id: string
  originalFileName: string
  fileSize: number
  mimeType: string
  checksum: string // 文件完整性校验

  // WebAV解析后的核心元数据
  duration?: number // 微秒（视频和音频需要）
  width?: number // 分辨率宽度（视频和图片需要）
  height?: number // 分辨率高度（视频和图片需要）

  // 缩略图信息
  thumbnailPath?: string

  // WebAV Clip重建信息
  clipType: 'MP4Clip' | 'ImgClip' | 'AudioClip'

  // 导入时间戳
  importedAt: string
}
```

### 5.3 同步状态文件 (sync-state.json)

```typescript
interface SyncState {
  lastSyncTime: string
  localFileHashes: Record<string, string>
  browserFileHashes: Record<string, string>
  pendingUploads: string[] // 需要从浏览器保存到本地的文件
  pendingDownloads: string[] // 需要从本地加载到浏览器的文件
  conflicts: ConflictInfo[]
}

interface ConflictInfo {
  fileName: string
  localModified: string
  browserModified: string
  reason: string
  strategy?: 'local-wins' | 'browser-wins' | 'manual'
}
```

## 6. WebAV Clip重建策略

### 6.1 核心原则：从源头重建

WebAV Clip对象不进行持久化，每次项目加载时从原始文件重新创建，确保对象完整性。

### 6.2 保存流程（浏览器 → 本地）

```typescript
const saveProjectToLocal = async (projectData: ProjectData) => {
  // 1. 提取业务数据（不包含WebAV Clip对象）
  const projectConfig: ProjectConfig = {
    id: projectData.id,
    name: projectData.name,
    settings: projectData.settings,
    timeline: {
      tracks: projectData.tracks,
      timelineItems: extractTimelineItemData(projectData.timelineItems),
      mediaItems: extractMediaItemData(projectData.mediaItems)
    },
    mediaReferences: {},
    exports: projectData.exports
  }

  // 2. 保存媒体文件和生成引用
  for (const mediaItem of projectData.mediaItems) {
    if (mediaItem.file) {
      const storedPath = await saveMediaFile(mediaItem.file, projectData.id)
      const metadata = await generateMediaMetadata(mediaItem)

      // 保存.meta文件
      await saveMediaMetadata(storedPath + '.meta', metadata)

      // 添加到引用映射
      projectConfig.mediaReferences[mediaItem.id] = {
        originalFileName: mediaItem.file.name,
        storedPath,
        type: mediaItem.type,
        fileSize: mediaItem.file.size,
        checksum: metadata.checksum
      }
    }
  }

  // 3. 保存项目配置文件
  await saveProjectConfig(projectConfig)
}
```

### 6.3 加载流程（本地 → 浏览器）

```typescript
const loadProjectFromLocal = async (projectId: string) => {
  // 1. 加载项目配置
  const projectConfig = await loadProjectConfig(projectId)

  // 2. 创建轨道结构
  videoStore.restoreTracks(projectConfig.timeline.tracks)

  // 3. 分阶段加载媒体文件
  const mediaItems: MediaItem[] = []

  for (const [mediaId, reference] of Object.entries(projectConfig.mediaReferences)) {
    // 加载本地文件
    const localFile = await loadFileFromLocal(reference.storedPath)
    const metadata = await loadMediaMetadata(reference.storedPath + '.meta')

    // 验证文件完整性
    const currentChecksum = await calculateChecksum(localFile)
    if (currentChecksum !== reference.checksum) {
      throw new Error(`文件完整性校验失败: ${reference.originalFileName}`)
    }

    // 重建WebAV Clip（从源头重建）
    const clip = await rebuildWebAVClip(localFile, reference.type)

    // 创建完整的MediaItem
    const mediaItem = createMediaItemFromClip(mediaId, localFile, clip, metadata)
    mediaItems.push(mediaItem)
  }

  // 4. 添加到store
  videoStore.restoreMediaItems(mediaItems)

  // 5. 恢复时间轴项目（TimelineItems）
  await restoreTimelineItems(projectConfig.timeline.timelineItems)
}

const rebuildWebAVClip = async (file: File, type: MediaType) => {
  const webAVControls = useWebAVControls()

  switch (type) {
    case 'video':
      return await webAVControls.createMP4Clip(file)
    case 'image':
      return await webAVControls.createImgClip(file)
    case 'audio':
      return await webAVControls.createAudioClip(file)
    default:
      throw new Error(`不支持的媒体类型: ${type}`)
  }
}
```

## 7. 自动保存与同步机制

### 7.1 自动保存策略

```typescript
interface AutoSaveConfig {
  debounceTime: 2000 // 2秒防抖
  throttleTime: 30000 // 30秒强制保存
  maxRetries: 3

  // 监听的状态变化
  watchedStates: {
    timelineItems: boolean
    tracks: boolean
    mediaItems: boolean
    projectConfig: boolean
  }
}

const autoSaveManager = {
  // 防抖保存
  debouncedSave: debounce(saveProject, 2000),

  // 节流保存（强制保存）
  throttledSave: throttle(saveProject, 30000),

  // 脏数据标记
  dirtyFlags: {
    timeline: false,
    media: false,
    config: false
  },

  // 触发保存
  triggerSave(changeType: string) {
    this.dirtyFlags[changeType] = true
    this.debouncedSave()
    this.throttledSave() // 确保最长30秒必须保存一次
  }
}
```

### 7.2 同步一致性检查

```typescript
const syncConsistencyCheck = async (projectId: string) => {
  const localFiles = await getLocalMediaFiles(projectId)
  const browserFiles = getBrowserMediaFiles(projectId)

  const inconsistencies = []

  // 检查缺失文件
  for (const [mediaId, browserFile] of browserFiles) {
    if (!localFiles.has(mediaId)) {
      inconsistencies.push({
        type: 'missing-local',
        mediaId,
        action: 'save-to-local'
      })
    }
  }

  // 检查文件完整性
  for (const [mediaId, localFile] of localFiles) {
    const browserFile = browserFiles.get(mediaId)
    if (browserFile) {
      const localChecksum = await calculateChecksum(localFile)
      const browserChecksum = await calculateChecksum(browserFile)

      if (localChecksum !== browserChecksum) {
        inconsistencies.push({
          type: 'checksum-mismatch',
          mediaId,
          action: 'resolve-conflict'
        })
      }
    }
  }

  return inconsistencies
}
```

### 7.3 分阶段项目加载优化

```typescript
const loadProjectOptimized = async (projectId: string) => {
  // 阶段1：快速加载项目结构（显示加载进度）
  showLoadingProgress('加载项目配置...', 10)
  const projectConfig = await loadProjectConfig(projectId)

  showLoadingProgress('创建轨道结构...', 20)
  createTracksFromConfig(projectConfig.timeline.tracks)

  // 阶段2：加载媒体元数据（快速显示媒体列表）
  showLoadingProgress('加载媒体信息...', 40)
  const mediaMetadata = await loadAllMediaMetadata(projectId)
  createPlaceholderMediaItems(mediaMetadata)

  // 阶段3：按需加载媒体文件（后台异步）
  showLoadingProgress('加载媒体文件...', 60)
  await loadMediaFilesInBatches(mediaMetadata, {
    batchSize: 3,
    onProgress: (loaded, total) => {
      const progress = 60 + (loaded / total) * 30
      showLoadingProgress(`加载媒体文件 ${loaded}/${total}...`, progress)
    }
  })

  // 阶段4：恢复时间轴项目（最后完成）
  showLoadingProgress('恢复时间轴项目...', 95)
  await restoreTimelineItems(projectConfig.timeline.timelineItems)

  showLoadingProgress('完成', 100)
  hideLoadingProgress()
}
```

## 8. 开发工具与调试功能

### 8.1 项目调试工具

为了便于开发和调试，在VideoEditor顶部栏添加了调试按钮，提供以下功能：

#### 🔍 **调试按钮功能**
- **位置**: VideoEditor顶部栏，导出按钮右侧
- **触发方式**:
  - 点击调试按钮（代码图标）
  - 键盘快捷键：`Ctrl + D`

#### 📊 **输出内容**

**1. 完整项目数据（包含运行时状态）**：
```javascript
{
  projectInfo: {
    currentProject: ProjectConfig,
    currentProjectId: string,
    projectStatus: string,
    // ... 其他项目状态
  },
  settings: {
    videoResolution: Resolution,
    frameRate: number,
    timelineDurationFrames: number
  },
  tracks: Track[],
  mediaItems: MediaItem[], // 包含运行时状态
  timelineItems: TimelineItem[], // 包含运行时状态
  mediaReferences: Record<string, MediaReference>,
  statistics: {
    totalMediaItems: number,
    readyMediaItems: number,
    // ... 其他统计信息
  }
}
```

**2. 持久化数据（纯净版本）**：
```javascript
{
  timeline: {
    tracks: Track[],
    timelineItems: TimelineItemData[], // 不包含运行时状态
    mediaItems: MediaItemData[] // 不包含运行时状态
  },
  settings: ProjectSettings,
  mediaReferences: Record<string, MediaReference>
}
```

#### 🎯 **使用场景**
- **开发调试**: 查看当前项目的完整状态
- **数据验证**: 对比运行时数据和持久化数据的差异
- **问题排查**: 快速定位数据结构问题
- **持久化测试**: 验证保存逻辑是否正确

#### 💡 **最佳实践**
1. 在修改数据结构后使用调试功能验证
2. 在实现新功能时对比数据变化
3. 在报告问题时提供调试输出
4. 定期检查持久化数据的纯净性

## 9. 错误处理与恢复机制

### 9.1 权限管理与恢复

```typescript
class PermissionManager {
  async checkAndRestorePermissions(): Promise<boolean> {
    try {
      const handle = await getDirectoryHandle('workspace')

      // 检查权限状态
      const permission = await handle.queryPermission({ mode: 'readwrite' })

      if (permission === 'granted') {
        return true
      }

      if (permission === 'prompt') {
        // 请求权限
        const newPermission = await handle.requestPermission({ mode: 'readwrite' })
        return newPermission === 'granted'
      }

      // 权限被拒绝，需要重新选择目录
      return await this.requestNewWorkspaceDirectory()

    } catch (error) {
      console.error('权限检查失败:', error)
      return await this.requestNewWorkspaceDirectory()
    }
  }

  async requestNewWorkspaceDirectory(): Promise<boolean> {
    try {
      const directoryHandle = await window.showDirectoryPicker()
      await storeDirectoryHandle('workspace', directoryHandle)
      return true
    } catch (error) {
      console.error('用户取消选择目录:', error)
      return false
    }
  }
}
```

### 9.2 文件完整性校验

```typescript
const verifyFileIntegrity = async (filePath: string, expectedChecksum: string): Promise<boolean> => {
  try {
    const file = await loadFileFromLocal(filePath)
    const actualChecksum = await calculateChecksum(file)
    return actualChecksum === expectedChecksum
  } catch (error) {
    console.error(`文件完整性校验失败: ${filePath}`, error)
    return false
  }
}

const calculateChecksum = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
```

### 9.3 浏览器兼容性检查

```typescript
const checkFileSystemAPISupport = (): boolean => {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('当前浏览器不支持 File System Access API，请使用 Chrome 86+ 或 Edge 86+ 等现代浏览器')
  }
  return true
}

const initializePersistence = async () => {
  // 检查API支持
  checkFileSystemAPISupport()

  // 初始化持久化系统
  const persistence = new FileSystemPersistence()
  await persistence.initialize()

  return persistence
}
```

## 10. 实施计划与当前进度

### 📋 **重新整理的实施计划（2025-07-06更新）**

根据"从浏览器到本地，然后从本地到浏览器"的实施优先级，重新调整实施计划如下：

#### ✅ **阶段1：浏览器到本地持久化（上传媒体保存到本地）** - **已完成**

**核心目标**: 实现用户上传媒体文件时，自动保存到本地项目目录并生成元数据的完整流程

**子任务列表**:
1. **实现MediaManager类** ✅ **已完成**
   - 创建MediaManager类，负责媒体文件的保存、加载和元数据管理
   - 定义核心接口：saveMediaToProject、generateMediaMetadata、verifyMediaIntegrity
   - 实现文件：`frontend/src/utils/MediaManager.ts`

2. **实现媒体文件保存功能** ✅ **已完成**
   - 实现saveMediaToProject方法，将浏览器中的媒体文件保存到本地项目目录的media文件夹
   - 按类型分类保存：videos/、images/、audio/
   - 生成唯一文件名避免冲突

3. **实现.meta文件生成和解析** ✅ **已完成**
   - 实现generateMediaMetadata方法，从WebAV Clip中提取元数据并生成.meta文件
   - 包含：duration、resolution、checksum、clipType等关键信息
   - 支持视频、图片、音频三种媒体类型

4. **实现文件完整性校验** ✅ **已完成**
   - 实现SHA-256 checksum计算和验证功能，确保文件完整性
   - 在保存和加载时进行校验
   - 提供verifyMediaIntegrity方法

5. **集成MediaManager到媒体上传流程** ✅ **已完成**
   - 修改MediaLibrary.vue中的媒体上传逻辑
   - 在创建WebAV Clip后自动调用MediaManager保存文件和元数据
   - 更新mediaItems的数据结构，包含本地文件引用

6. **实现项目保存功能** ✅ **已完成**
   - 完善ProjectManager的saveProject方法，保存项目配置和媒体引用映射
   - 确保项目JSON包含完整的mediaReferences信息
   - 创建ProjectModule管理当前项目状态

7. **实现自动保存机制** ✅ **已完成**
   - 创建useAutoSave composable，实现防抖+节流的自动保存策略
   - 监听关键状态变化：timelineItems、tracks、mediaItems、projectConfig
   - 支持手动保存、启用/禁用、重试机制

#### ✅ **阶段2：本地到浏览器加载（点击项目打开页面）** - **已完成 (100%)**

**核心目标**: 实现从本地项目文件加载，重建时间轴的完整流程

**子任务列表**:
1. **实现媒体文件加载功能** ✅ **已完成**
   - ✅ 实现loadMediaFromProject方法，从本地项目目录加载媒体文件
   - ✅ 验证文件完整性和.meta文件一致性
   - ✅ 实现rebuildMediaItemFromLocal方法，完整重建MediaItem对象

2. **实现WebAV Clip重建机制** ✅ **已完成**
   - ✅ 实现rebuildWebAVClip方法，从本地文件重新创建MP4Clip/ImgClip/AudioClip对象
   - ✅ 确保从源头重建，不依赖缓存的WebAV对象
   - ✅ 实现loadAllMediaForProject方法，支持批量加载和进度回调

3. **实现项目加载流程** ✅ **已完成**
   - ✅ 完善ProjectManager的loadProjectWithOptions方法，实现分阶段加载优化
   - ✅ 流程：项目配置→轨道结构→媒体文件→时间轴项目
   - ✅ 支持加载选项配置和进度回调

4. **集成到项目管理页面** ✅ **已完成**
   - ✅ 修改项目管理页面的打开项目功能，调用完整的项目加载流程
   - ✅ 使用window.location.href方式确保完整的页面重载和store重置
   - ✅ 项目加载进度在控制台正常显示

5. **实现store状态恢复** ✅ **已完成**
   - ✅ 实现restoreMediaItems方法，媒体项目恢复到store正常工作
   - ✅ 实现restoreTracks方法，轨道结构完整恢复
   - ✅ 实现restoreTimelineItems方法，时间轴项目完整恢复
   - ✅ 实现rebuildTimelineItemSprites方法，从原始素材重建所有sprite
   - ✅ 修复缩略图恢复问题，确保时间轴项目缩略图正确显示

### 🎯 **当前状态分析（2025-07-06更新）**

#### ✅ **已完成的核心组件**
- **DirectoryManager**: 完全实现，目录选择和权限管理良好
- **ProjectManager**: 完全实现，项目创建、保存、加载功能完备
- **MediaManager**: ✅ **完全实现**，媒体文件保存、元数据管理、完整性校验、批量加载
- **ProjectModule**: ✅ **完全实现**，当前项目状态管理和媒体引用映射
- **AutoSave**: ✅ **完全实现**，防抖+节流自动保存机制
- **WebAV Clip创建和重建**: ✅ **完全实现**，包括createMP4Clip、createImgClip、createAudioClip和rebuildWebAVClip方法
- **数据结构定义**: ProjectConfig和MediaMetadata接口已定义并优化

#### ✅ **已完成的集成功能**
- **媒体上传流程**: 已集成MediaManager，自动保存文件和生成元数据
- **项目状态管理**: VideoStore已集成ProjectModule
- **自动保存**: VideoEditor已集成useAutoSave composable
- **数据持久化**: 优化了保存逻辑，移除运行时状态，确保数据纯净性
- **媒体文件加载**: ✅ **新增完成**，从本地完整重建MediaItem对象
- **项目加载流程**: ✅ **完全实现**，分阶段加载优化，支持进度回调
- **时间轴项目恢复**: ✅ **完全实现**，包括sprite重建和缩略图重新生成

#### 🔧 **开发工具**
- **调试功能**: ✅ **完全实现**，VideoEditor顶部栏调试按钮（Ctrl+D）
- **单元测试**: 已创建MediaManager测试文件

#### ✅ **已完成组件（阶段2）**
- **Store状态恢复**:
  - ✅ **restoreMediaItems方法**: 已实现并正常工作
  - ✅ **restoreTracks方法**: 轨道结构完整恢复
  - ✅ **restoreTimelineItems方法**: 时间轴项目完整恢复，包括sprite重建
  - ✅ **缩略图恢复机制**: 修复blob URL失效问题，重新生成缩略图

#### � **整体进度评估**
- **阶段1完成度**: 100% ✅ - 浏览器到本地持久化完全实现
- **阶段2完成度**: 100% ✅ - 本地到浏览器加载完全实现
- **整体进度**: 100% ✅ - 完整的本地持久化系统已实现

### 📈 **实施里程碑**

#### ✅ **里程碑1**: 完成阶段1 - **已达成** (2025-07-06)
- **标志**: 用户上传媒体后，文件自动保存到本地，项目可以持久化
- **验收标准**: ✅ **全部达成**
  - ✅ 媒体文件正确保存到本地项目目录
  - ✅ .meta文件正确生成并包含完整元数据
  - ✅ 项目JSON包含正确的媒体引用映射
  - ✅ 自动保存机制正常工作
  - ✅ 调试工具完善，便于开发和测试

#### ✅ **里程碑2**: 完成阶段2 - **已完成 (100%)**
- **标志**: 用户可以打开本地项目，完整恢复编辑器状态
- **验收标准**:
  - ✅ 项目配置正确加载
  - ✅ 所有媒体文件正确重建为WebAV Clips
  - ✅ 媒体项目正确恢复到素材库
  - ✅ 轨道结构完整恢复
  - ✅ 项目加载后时间轴完全恢复，包括sprite重建
  - ✅ 时间轴项目缩略图正确显示
  - ✅ 编辑器功能完全可用
  - ✅ 加载性能良好（分阶段加载优化）

### 🔄 **迭代策略**

1. **快速原型**: 先实现核心功能，后优化性能和用户体验
2. **增量验证**: 每个子任务完成后立即测试验证
3. **向后兼容**: 确保新的持久化系统不破坏现有功能
4. **错误恢复**: 在每个阶段都考虑错误处理和恢复机制

## 11. 核心优势

### 11.1 技术优势
- **从源头重建**: 确保WebAV对象的完整性和一致性
- **增量同步**: 只同步变更的文件，提高效率
- **完整性保证**: 文件校验和确保数据完整性
- **分阶段加载**: 优化大项目的加载体验

### 11.2 用户体验优势
- **类桌面体验**: 真正的本地文件管理
- **数据安全**: 用户完全控制自己的数据
- **离线工作**: 无需网络连接即可工作
- **跨设备同步**: 通过文件夹同步实现跨设备访问

### 11.3 开发优势
- **架构清晰**: 模块化设计，职责分离
- **易于扩展**: 支持新的媒体类型和功能
- **错误恢复**: 完善的错误处理和权限管理机制
- **性能优化**: 多种优化策略确保流畅体验

## 12. 总结

这个基于File System Access API的持久化方案，通过"从源头重建"的核心原则，实现了浏览器视频编辑器与本地文件系统的深度集成。方案不仅解决了数据持久化的技术挑战，更为用户提供了类似桌面应用的文件管理体验，同时保持了Web应用的便利性和安全性。

### 🎯 **项目完成成果（2025-07-06更新）**

✅ **阶段1：浏览器到本地持久化** 已完全实现 (100%)

✅ **阶段2：本地到浏览器加载** 已完全实现 (100%)

**已完成的核心组件**：
- **MediaManager类**: 完整的媒体文件管理系统，支持保存、加载、元数据生成、完整性校验和批量重建
- **ProjectManager类**: 完整的项目管理系统，支持分阶段加载优化和进度回调
- **ProjectModule**: 项目状态管理和媒体引用映射
- **AutoSave机制**: 防抖+节流的智能自动保存策略

**已完成的集成功能**：
- **媒体上传流程**: 自动保存文件到本地并生成.meta文件
- **媒体加载流程**: 从本地完整重建MediaItem对象，包括WebAV Clip重建
- **项目持久化**: 优化的数据保存逻辑，移除运行时状态
- **项目加载流程**: 分阶段加载优化，媒体文件正确恢复到素材库
- **调试工具**: 完善的项目数据调试功能

**数据持久化原则**：
- 明确区分运行时状态和持久化数据
- 确保项目JSON的纯净性和一致性
- 实现"从源头重建"的核心原则

### 🎉 **项目完成：完整的本地持久化系统**

**已实现功能**：
- ✅ **完整的项目生命周期管理**：创建、编辑、保存、加载
- ✅ **媒体文件本地持久化**：自动保存到本地目录，支持完整性校验
- ✅ **项目状态完整恢复**：包括媒体库、轨道结构、时间轴项目
- ✅ **WebAV对象重建**：从原始文件重新创建所有sprite
- ✅ **缩略图自动重新生成**：解决blob URL失效问题
- ✅ **分阶段加载优化**：提供良好的用户体验和进度反馈

### 🔧 **技术实施的关键决策**

- **MediaManager作为核心**: 所有媒体文件的持久化操作都通过统一的MediaManager类进行
- **从源头重建**: WebAV Clip对象不持久化，每次从原始文件重新创建，确保对象完整性
- **增量实施**: 每个子任务都可以独立验证，降低实施风险
- **向后兼容**: 新的持久化系统不会破坏现有的编辑器功能

通过这个分阶段的实施计划，已经成功构建了一个完整、可靠、高性能的本地持久化系统，为视频编辑器项目奠定了坚实的数据管理基础。该系统实现了从浏览器到本地的完整数据流转，确保用户的工作成果得到可靠保存和完整恢复。

---

## 🔧 **技术细节：缩略图恢复机制**

### 🐛 **问题背景**
在项目恢复过程中发现时间轴项目的缩略图显示异常，主要原因是保存的`thumbnailUrl`为blob URL，在页面重新加载后这些URL已经失效。

### ✅ **解决方案**

#### **1. 问题分析**
- **Blob URL生命周期**：blob URL只在当前页面会话中有效，页面刷新后失效
- **保存策略问题**：项目JSON中保存了临时的blob URL而非持久化的缩略图数据
- **恢复流程缺陷**：直接使用失效的URL，没有重新生成机制

#### **2. 修复实现**
```typescript
// 在restoreTimelineItems中清除失效的缩略图URL
const timelineItem: Partial<TimelineItem> = {
  id: itemData.id,
  mediaItemId: itemData.mediaItemId,
  trackId: itemData.trackId,
  mediaType: itemData.mediaType,
  timeRange: itemData.timeRange,
  config: itemData.config,
  // thumbnailUrl: undefined // 将在重建sprite后重新生成
}

// 在rebuildTimelineItemSprites中重新生成缩略图
if (mediaItem.mediaType !== 'audio') {
  console.log(`🖼️ 重新生成缩略图: ${timelineItem.id}`)
  const newThumbnailUrl = await regenerateThumbnailForTimelineItem(timelineItem, mediaItem)
  if (newThumbnailUrl) {
    timelineItem.thumbnailUrl = newThumbnailUrl
    console.log(`✅ 缩略图重新生成完成: ${timelineItem.id}`)
  }
}
```

#### **3. 技术要点**
- **从源头重建**：基于当前的WebAV Clip和时间范围重新生成缩略图
- **类型区分处理**：只为视频和图片类型生成缩略图，跳过音频
- **时间精确性**：使用时间轴项目的实际时间范围生成对应帧的缩略图
- **资源管理**：确保新生成的blob URL正确设置，避免内存泄漏

#### **4. 恢复流程优化**
1. **项目加载** → 恢复时间轴项目数据（不包含缩略图）
2. **Sprite重建** → 从原始媒体文件重新创建WebAV对象
3. **缩略图重新生成** → 基于重建的sprite生成新的缩略图
4. **UI更新** → 时间轴显示正确的缩略图

### 🎯 **效果验证**
修复后的缩略图恢复机制确保：
- ✅ 时间轴项目缩略图在项目重新加载后正确显示
- ✅ 缩略图内容反映当前的时间范围设置
- ✅ 视频缩略图显示正确的帧内容
- ✅ 图片缩略图完整显示
- ✅ 系统性能良好，缩略图生成不阻塞主流程
