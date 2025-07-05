# File System Access API 持久化方案设计

## 1. 概述

本文档描述了基于File System Access API的持久化方案设计，用于实现视频编辑器项目的本地文件存储和项目管理功能。该方案允许用户在首次访问时选择一个本地文件夹，并持久化保持对该文件夹的访问权限。

## 2. 整体架构设计

### 2.1 核心组件架构

```
FileSystemPersistence (核心持久化管理器)
├── DirectoryManager (目录访问管理)
├── ProjectManager (项目文件管理)
├── MediaManager (媒体文件管理)
├── ConfigManager (配置文件管理)
└── BackupManager (备份恢复管理)
```

### 2.2 数据存储结构

```
用户选择的项目根目录/
├── projects/                    # 项目文件夹
│   ├── project-1/
│   │   ├── project.json        # 项目配置和时间轴数据
│   │   ├── media/              # 项目媒体文件
│   │   │   ├── videos/
│   │   │   ├── images/
│   │   │   ├── audio/
│   │   │   └── thumbnails/     # 缩略图缓存
│   │   └── exports/            # 导出文件
│   └── project-2/
├── templates/                   # 项目模板
├── settings/                    # 全局设置
│   ├── app-config.json         # 应用配置
│   ├── user-preferences.json   # 用户偏好设置
│   └── recent-projects.json    # 最近项目列表
└── cache/                      # 缓存文件
    ├── thumbnails/             # 全局缩略图缓存
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
- `loadProject(projectId)` - 加载项目
- `listProjects()` - 获取项目列表
- `deleteProject(projectId)` - 删除项目
- `exportProject(projectId, format)` - 导出项目

### 3.3 MediaManager (媒体文件管理)

**职责：**
- 媒体文件的导入、存储、管理
- 缩略图生成和缓存
- 媒体文件引用管理

**核心功能：**
- `importMediaFiles(files, projectId)` - 导入媒体文件
- `copyMediaToProject(file, projectId)` - 复制媒体文件到项目目录
- `generateThumbnail(mediaFile)` - 生成缩略图
- `getMediaPath(mediaId, projectId)` - 获取媒体文件路径
- `cleanupUnusedMedia(projectId)` - 清理未使用的媒体文件

### 3.4 ConfigManager (配置文件管理)

**职责：**
- 应用配置的持久化
- 用户偏好设置管理
- 配置文件的备份和恢复

**核心功能：**
- `saveAppConfig(config)` - 保存应用配置
- `loadAppConfig()` - 加载应用配置
- `saveUserPreferences(preferences)` - 保存用户偏好
- `loadUserPreferences()` - 加载用户偏好
- `resetToDefaults()` - 重置为默认配置

### 3.5 BackupManager (备份恢复管理)

**职责：**
- 自动备份机制
- 项目历史版本管理
- 数据恢复功能

**核心功能：**
- `createBackup(projectId)` - 创建项目备份
- `scheduleAutoBackup(projectId, interval)` - 安排自动备份
- `listBackups(projectId)` - 列出备份版本
- `restoreFromBackup(backupId)` - 从备份恢复
- `cleanupOldBackups(projectId, keepCount)` - 清理旧备份

## 4. 数据结构设计

### 4.1 项目配置文件 (project.json)

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
    // 其他配置...
  }
  
  // 时间轴数据
  timeline: {
    tracks: Track[]
    timelineItems: TimelineItemData[]
    mediaItems: MediaItemData[]
  }
  
  // 媒体文件引用
  mediaReferences: {
    [mediaId: string]: {
      originalPath: string
      storedPath: string
      type: MediaType
      size: number
      checksum?: string
    }
  }
  
  // 导出历史
  exports: ExportRecord[]
}
```

### 4.2 应用配置文件 (app-config.json)

```typescript
interface AppConfig {
  version: string
  workspaceDirectory: string
  lastOpenedProject?: string
  
  // UI设置
  ui: {
    theme: 'light' | 'dark'
    language: string
    snapConfig: SnapConfig
    // 其他UI配置...
  }
  
  // 性能设置
  performance: {
    autoSaveInterval: number
    maxBackupCount: number
    thumbnailQuality: number
    // 其他性能配置...
  }
}
```

## 5. 与现有架构集成

### 5.1 与Pinia Store集成

```typescript
// 新增 persistenceModule
export function createPersistenceModule() {
  const fileSystemPersistence = new FileSystemPersistence()
  
  return {
    // 初始化持久化系统
    async initializePersistence() {
      await fileSystemPersistence.initialize()
    },
    
    // 保存当前项目状态
    async saveCurrentProject() {
      const projectData = extractProjectData()
      await fileSystemPersistence.saveProject(projectData)
    },
    
    // 加载项目
    async loadProject(projectId: string) {
      const projectData = await fileSystemPersistence.loadProject(projectId)
      await restoreProjectData(projectData)
    }
  }
}
```

### 5.2 自动保存机制

- 监听关键状态变化（timelineItems、tracks、config等）
- 实现防抖保存，避免频繁写入
- 提供手动保存和自动保存两种模式

### 5.3 错误处理和降级方案

- 权限丢失时的重新授权流程
- File System Access API不支持时的降级方案（使用IndexedDB + 文件下载）
- 网络存储选项（可选的云同步功能）

## 6. 用户体验设计

### 6.1 首次使用流程

1. **欢迎页面** - 介绍File System Access API的优势
2. **目录选择** - 引导用户选择工作目录
3. **权限说明** - 解释需要的权限和用途
4. **初始化完成** - 显示设置成功，可以开始使用

### 6.2 权限管理

- 权限状态指示器
- 权限丢失时的友好提示
- 一键重新授权功能
- 权限管理设置页面

### 6.3 项目管理界面

- 项目列表视图（网格/列表切换）
- 项目搜索和筛选
- 项目模板选择
- 最近项目快速访问

## 7. 技术实现要点

### 7.1 权限持久化

```typescript
// 使用IndexedDB存储目录句柄
const directoryHandle = await window.showDirectoryPicker()
await storeDirectoryHandle('workspace', directoryHandle)

// 恢复时验证权限
const handle = await getDirectoryHandle('workspace')
if (await handle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
  await handle.requestPermission({ mode: 'readwrite' })
}
```

### 7.2 文件操作封装

```typescript
class FileSystemManager {
  async writeFile(path: string, content: string | ArrayBuffer) {
    const fileHandle = await this.getFileHandle(path, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(content)
    await writable.close()
  }
  
  async readFile(path: string): Promise<string | ArrayBuffer> {
    const fileHandle = await this.getFileHandle(path)
    const file = await fileHandle.getFile()
    return await file.text() // 或 file.arrayBuffer()
  }
}
```

### 7.3 性能优化

- 文件操作的批量处理
- 缩略图的懒加载和缓存
- 大文件的分块处理
- 后台任务队列管理

## 8. 安全考虑

### 8.1 数据验证

- 项目文件的完整性检查
- 媒体文件的类型验证
- 配置文件的格式验证

### 8.2 隐私保护

- 本地存储，不上传到服务器
- 敏感信息的加密存储
- 用户数据的完全控制权

## 9. 实施计划

### 阶段1：基础架构
- 实现DirectoryManager和基础文件操作
- 创建项目配置文件结构
- 集成到现有Pinia Store

### 阶段2：项目管理
- 实现ProjectManager和MediaManager
- 添加项目创建、保存、加载功能
- 实现媒体文件管理

### 阶段3：用户界面
- 创建项目管理界面
- 实现首次使用引导流程
- 添加权限管理界面

### 阶段4：高级功能
- 实现自动备份和恢复
- 添加项目模板系统
- 性能优化和错误处理完善

## 10. 总结

这个File System Access API持久化方案提供了完整的本地文件存储解决方案，充分利用了现代浏览器的文件系统访问能力，为用户提供了类似桌面应用的文件管理体验，同时保持了Web应用的便利性和安全性。
