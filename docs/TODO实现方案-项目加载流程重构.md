# TODO实现方案：项目加载流程重构

## 目标
重构 `UnifiedProjectModule.ts` 中的 `loadProjectContent` 函数，实现正确的项目加载架构顺序。

## 当前TODO描述
```typescript
// TODO：
// 这里应该先loadProjectConfig获取项目配置
// 然后初始化页面级媒体管理器，扫描meta文件构建文件索引
// 然后先构建媒体项目，启动数据源的获取
// 接着恢复时间轴轨道，以及项目
```

## 当前问题分析

### 现有实现问题
- 直接调用 `projectFileOperations.loadProjectContent()` 并简单模拟加载过程
- 缺少统一媒体管理架构的集成
- 没有按照正确的初始化顺序进行项目加载
- 缺少meta驱动的媒体文件索引机制

### 架构不一致
- 项目使用了新的统一媒体管理架构，但加载流程还在使用旧的模式
- 没有利用 `ProjectMediaManager` 的meta文件扫描能力
- 媒体项目的重建流程缺失

## 实现方案

### 步骤1: 加载项目配置
```typescript
// 使用现有的轻量级配置加载
const projectConfig = await projectFileOperations.loadProjectConfig(projectId)
if (!projectConfig) {
  throw new Error('项目配置不存在')
}
```

**关键点：**
- 使用 `ProjectFileOperations.loadProjectConfig()` 方法
- 验证项目配置的完整性和必要字段
- 为后续初始化提供配置基础

### 步骤2: 初始化页面级媒体管理器
```typescript
// 初始化媒体管理器
const { globalProjectMediaManager } = await import('@/unified/utils/ProjectMediaManager')
globalProjectMediaManager.initializeForProject(projectId)

// 扫描meta文件构建文件索引
const mediaReferences = await globalProjectMediaManager.scanMediaDirectory()
```

**关键点：**
- 为当前项目初始化媒体管理器
- 通过meta文件扫描建立媒体文件索引
- 利用现有的meta驱动架构

### 步骤3: 构建媒体项目并启动数据源获取
```typescript
// 获取统一媒体模块
const { createUnifiedMediaModule } = await import('@/unified/modules/UnifiedMediaModule')
const mediaModule = createUnifiedMediaModule()

// 基于媒体引用重建媒体项目
for (const mediaRef of mediaReferences) {
  // 从磁盘加载媒体文件
  const file = await globalProjectMediaManager.loadMediaFromProject(projectId, mediaRef.storedPath)
  
  // 创建统一媒体项目
  const mediaItem = createUnifiedMediaItemData({
    name: mediaRef.originalFileName,
    mediaType: mediaRef.mediaType,
    source: {
      type: 'file',
      file: file,
      url: URL.createObjectURL(file),
      mediaReferenceId: mediaRef.id // 设置媒体管理器引用ID
    }
  })
  
  // 添加到媒体模块并启动处理
  mediaModule.addMediaItem(mediaItem)
  mediaModule.startMediaProcessing(mediaItem)
}
```

**关键点：**
- 基于扫描到的媒体引用重建媒体项目
- 建立媒体项目与磁盘文件的关联
- 启动WebAV解析和数据源获取流程
- 设置媒体管理器引用ID实现关联

### 步骤4: 恢复时间轴轨道和项目状态
```typescript
// 加载时间轴数据和轨道信息
const timelineResult = await projectFileOperations.loadProjectContent(projectId, {
  loadMedia: false, // 媒体已在步骤3中处理
  loadTimeline: true,
  onProgress: (stage, progress) => {
    updateLoadingProgress(stage, progress)
  }
})

if (timelineResult?.timelineItems && timelineResult?.tracks) {
  // 恢复时间轴项目
  timelineResult.timelineItems.forEach(timelineItem => {
    // 添加到统一存储
    unifiedStore.addTimelineItem(timelineItem)
  })
  
  // 恢复轨道配置
  timelineResult.tracks.forEach(track => {
    // 恢复轨道状态
    unifiedStore.addTrack(track)
  })
}
```

**关键点：**
- 复用现有的时间轴加载逻辑
- 避免重复加载媒体文件
- 恢复完整的项目状态

## 完整实现代码结构

```typescript
async function loadProjectContent(projectId: string): Promise<void> {
  try {
    isLoading.value = true
    updateLoadingProgress('开始加载项目内容...', 5)
    
    // 1. 加载项目配置
    updateLoadingProgress('加载项目配置...', 10)
    const projectConfig = await projectFileOperations.loadProjectConfig(projectId)
    if (!projectConfig) {
      throw new Error('项目配置不存在')
    }
    
    // 2. 初始化页面级媒体管理器
    updateLoadingProgress('初始化媒体管理器...', 20)
    const { globalProjectMediaManager } = await import('@/unified/utils/ProjectMediaManager')
    globalProjectMediaManager.initializeForProject(projectId)
    
    // 3. 扫描meta文件构建文件索引
    updateLoadingProgress('扫描媒体文件索引...', 30)
    const mediaReferences = await globalProjectMediaManager.scanMediaDirectory()
    
    // 4. 构建媒体项目，启动数据源获取
    updateLoadingProgress('重建媒体项目...', 50)
    await rebuildMediaItems(mediaReferences)
    
    // 5. 恢复时间轴轨道和项目状态
    updateLoadingProgress('恢复时间轴数据...', 80)
    await restoreTimelineAndTracks(projectId)
    
    updateLoadingProgress('项目内容加载完成', 100)
    isProjectContentReady.value = true
    
  } catch (error) {
    console.error('❌ [Content Load] 加载项目内容失败:', error)
    throw error
  } finally {
    resetLoadingState()
  }
}
```

## 技术要点

### 依赖导入
- 需要动态导入 `ProjectMediaManager` 和 `UnifiedMediaModule`
- 保持现有的进度回调机制

### 错误处理
- 保持现有的错误处理和日志记录
- 确保加载失败时的状态清理

### 性能考虑
- 媒体文件的加载可能耗时，需要合适的进度反馈
- 考虑并发处理多个媒体文件的重建

### 兼容性
- 保持与现有 `UnifiedProjectModule` 接口的兼容性
- 不影响其他模块对该函数的调用

## 预期效果

1. **架构统一**：项目加载流程完全符合新的统一媒体管理架构
2. **数据一致性**：通过meta文件确保媒体数据的权威性和一致性
3. **性能优化**：避免重复扫描和加载，提高加载效率
4. **健壮性增强**：更好的错误处理和状态管理

## 实施注意事项

1. **测试覆盖**：需要测试各种项目状态（空项目、有媒体项目、损坏项目等）
2. **向后兼容**：确保旧项目能正常加载
3. **日志记录**：保持详细的加载过程日志便于调试
4. **进度反馈**：用户体验友好的加载进度显示

## 文件位置
- 主要修改：`frontend/src/unified/modules/UnifiedProjectModule.ts:227`
- 涉及模块：`ProjectMediaManager`, `UnifiedMediaModule`, `ProjectFileOperations`