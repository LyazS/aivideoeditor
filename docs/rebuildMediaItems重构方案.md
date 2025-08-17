# rebuildMediaItems 重构方案

## 问题分析

### 当前实现问题

当前 `rebuildMediaItems` 函数（位于 `UnifiedProjectModule.ts:287`）存在以下问题：

1. **数据源错误**：使用 `mediaReferences`（来自扫描媒体目录）作为重建数据源，而不是使用 `projectConfig.timeline.mediaItems`
2. **重建逻辑单一**：只支持用户选择文件类型的重建，缺乏对不同数据源类型的差异化处理
3. **缺少数据源特定重建策略**：不同数据源（用户选择文件 vs 远程下载文件）应该有不同的重建和恢复机制

### 影响范围

- 项目加载时媒体文件重建可能失败
- 远程下载的媒体文件在本地缺失时无法自动重新下载
- 项目配置中保存的媒体项目信息没有被正确使用

## 重构方案

### 1. 修改数据源

#### 当前代码位置
`frontend/src/unified/modules/UnifiedProjectModule.ts:267`

#### 修改内容
```typescript
// 当前实现
await rebuildMediaItems(mediaReferences)

// 修改为
const projectConfig = await projectFileOperations.loadProjectConfig(projectId)
await rebuildMediaItems(projectConfig.timeline.mediaItems, mediaReferences)
```

#### 目标
确保使用项目配置中保存的媒体项目数据作为重建的权威数据源，同时利用媒体引用信息来定位实际的文件路径和元数据。

### 2. 在基类中添加重建方法接口

#### 修改位置
`frontend/src/unified/sources/BaseDataSource.ts`

#### 新增重建接口
```typescript
// ==================== 工厂重建方法 ====================

/**
 * 数据源工厂重建方法的统一调度器
 * 根据数据源类型调用对应工厂的重建方法
 */
export const DataSourceRebuildDispatcher = {
  /**
   * 根据数据源类型调度到对应的重建方法
   * @param mediaItem 媒体项目数据
   * @param mediaReferences 媒体引用数组
   * @param projectId 项目ID
   * @returns 重建后的数据源
   */
  async rebuildDataSource(
    mediaItem: UnifiedMediaItemData,
    mediaReferences: any[],
    projectId: string
  ): Promise<BaseDataSourceData> {
    const sourceType = mediaItem.source.type
    
    switch (sourceType) {
      case 'user-selected':
        return await UserSelectedFileSourceFactory.rebuildSource(mediaItem, mediaReferences, projectId)
      case 'remote':
        return await RemoteFileSourceFactory.rebuildSource(mediaItem, mediaReferences, projectId)
      default:
        throw new Error(`Unsupported source type for rebuild: ${sourceType}`)
    }
  }
}
```

### 3. 为各个数据源类型实现重建方法

#### 3.1 用户选择文件源重建方法

**文件位置**: `frontend/src/unified/sources/UserSelectedFileSource.ts`

**扩展数据源接口**:
```typescript
/**
 * 用户选择文件数据源 - 扩展重建功能
 */
export interface UserSelectedFileSourceData extends BaseDataSourceData {
  type: 'user-selected'
  selectedFile: File
}
```

**工厂函数更新**:
```typescript
export const UserSelectedFileSourceFactory = {
  createUserSelectedSource(file: File): UserSelectedFileSourceData {
    const source = reactive({
      id: generateUUID4(),
      type: 'user-selected',
      status: 'pending',
      progress: 0,
      file: null,
      url: null,
      selectedFile: file,
    }) as UserSelectedFileSourceData
    
    return source
  },

  // 🆕 静态重建方法
  async rebuildSource(
    mediaItem: UnifiedMediaItemData,
    mediaReferences: any[],
    projectId: string
  ): Promise<UserSelectedFileSourceData> {
    // 1. 通过mediaReferenceId找到对应的媒体引用
    const mediaRef = mediaReferences.find(ref => ref.id === mediaItem.source.mediaReferenceId)
    if (!mediaRef) {
      throw new Error(`找不到媒体引用: ${mediaItem.source.mediaReferenceId}`)
    }
    
    // 2. 从项目媒体目录加载文件
    const file = await globalProjectMediaManager.loadMediaFromProject(
      projectId,
      mediaRef.storedPath
    )
    
    // 3. 创建新的数据源
    const newSource = UserSelectedFileSourceFactory.createUserSelectedSource(file)
    newSource.mediaReferenceId = mediaRef.id
    
    // 4. 直接设置为已获取状态
    DataSourceBusinessActions.completeAcquisition(newSource, file, URL.createObjectURL(file))
    
    return newSource
  }
}
```

#### 3.2 远程文件源重建方法

**文件位置**: `frontend/src/unified/sources/RemoteFileSource.ts`

**扩展数据源接口**:
```typescript
/**
 * 远程文件数据源 - 扩展重建功能
 */
export interface RemoteFileSourceData extends BaseDataSourceData {
  type: 'remote'
  remoteUrl: string
  config: RemoteFileConfig
  downloadedBytes: number
  totalBytes: number
  downloadSpeed?: string
  startTime?: number
}
```

**工厂函数更新**:
```typescript
export const RemoteFileSourceFactory = {
  createRemoteSource(remoteUrl: string, config: RemoteFileConfig = {}): RemoteFileSourceData {
    const source = reactive({
      id: generateUUID4(),
      type: 'remote',
      status: 'pending',
      progress: 0,
      file: null,
      url: null,
      remoteUrl,
      config,
      downloadedBytes: 0,
      totalBytes: 0,
    }) as RemoteFileSourceData
    
    return source
  },

  // 🆕 静态重建方法
  async rebuildSource(
    mediaItem: UnifiedMediaItemData,
    mediaReferences: any[],
    projectId: string
  ): Promise<RemoteFileSourceData> {
    const remoteSource = mediaItem.source as RemoteFileSourceData
    
    // 1. 通过mediaReferenceId找到对应的媒体引用
    const mediaRef = mediaReferences.find(ref => ref.id === remoteSource.mediaReferenceId)
    if (!mediaRef) {
      throw new Error(`找不到媒体引用: ${remoteSource.mediaReferenceId}`)
    }
    
    // 2. 尝试从本地加载文件
    try {
      const file = await globalProjectMediaManager.loadMediaFromProject(
        projectId,
        mediaRef.storedPath
      )
      
      // 本地文件存在，直接使用
      const newSource = RemoteFileSourceFactory.createRemoteSource(
        remoteSource.remoteUrl,
        remoteSource.config
      )
      newSource.mediaReferenceId = mediaRef.id
      
      DataSourceBusinessActions.completeAcquisition(newSource, file, URL.createObjectURL(file))
      return newSource
      
    } catch (error) {
      // 3. 本地文件不存在，创建需要重新下载的数据源
      const newSource = RemoteFileSourceFactory.createRemoteSource(
        remoteSource.remoteUrl,
        remoteSource.config
      )
      newSource.mediaReferenceId = mediaRef.id
      
      // 设置为缺失状态，等待重新下载
      DataSourceBusinessActions.setMissing(newSource)
      
      return newSource
    }
  }
}
```

### 4. 简化 rebuildMediaItems 函数

#### 修改位置
`frontend/src/unified/modules/UnifiedProjectModule.ts:287`

#### 新的实现逻辑
```typescript
async function rebuildMediaItems(
  savedMediaItems: UnifiedMediaItemData[], 
  mediaReferences: any[]
): Promise<void> {
  try {
    if (!mediaModule) {
      throw new Error('媒体模块未初始化，请在构造函数中传入 mediaModule 参数')
    }

    // 基于保存的媒体项目数据重建
    for (const savedMediaItem of savedMediaItems) {
      try {
        // 🆕 使用调度器根据类型调用对应工厂的重建方法
        const rebuiltSource = await DataSourceRebuildDispatcher.rebuildDataSource(
          savedMediaItem,
          mediaReferences,
          configModule.projectId.value
        )

        // 创建新的媒体项目（保持原有的ID和配置）
        const mediaItem = mediaModule.createUnifiedMediaItemData(
          savedMediaItem.id,
          savedMediaItem.name,
          rebuiltSource,
          {
            mediaType: savedMediaItem.mediaType,
            mediaStatus: DataSourceQueries.getMediaStatus(rebuiltSource),
            duration: savedMediaItem.duration,
          }
        )

        // 添加到媒体模块
        mediaModule.addMediaItem(mediaItem)
        
        // 如果数据源已准备好，启动WebAV处理
        if (DataSourceQueries.isAcquired(rebuiltSource)) {
          mediaModule.startMediaProcessing(mediaItem)
        }
        
      } catch (error) {
        console.error(`重建媒体项目失败: ${savedMediaItem.name}`, error)
        
        // 创建错误状态的媒体项目，让用户知道哪个文件有问题
        const errorSource = DataSourceFactory.createUserSelectedSource(new File([], savedMediaItem.name))
        DataSourceBusinessActions.setError(errorSource, `重建失败: ${error.message}`)
        
        const errorMediaItem = mediaModule.createUnifiedMediaItemData(
          savedMediaItem.id,
          savedMediaItem.name,
          errorSource,
          {
            mediaType: savedMediaItem.mediaType,
            mediaStatus: 'error',
          }
        )
        
        mediaModule.addMediaItem(errorMediaItem)
      }
    }
  } catch (error) {
    console.error('重建媒体项目过程失败:', error)
    throw error
  }
}
```

## 实现步骤

### 第一步：修改数据源调用
1. 在 `loadProjectContent` 函数中修改 `rebuildMediaItems` 的调用
2. 确保传入 `projectConfig.timeline.mediaItems` 和 `mediaReferences` 两个参数
3. `projectConfig.timeline.mediaItems` 提供保存的媒体项目配置
4. `mediaReferences` 提供实际的文件路径和元数据信息

### 第二步：在基类中添加重建接口
1. 在 `BaseDataSource.ts` 中添加 `DataSourceRebuildActions` 接口
2. 定义统一的重建方法签名

### 第三步：为各数据源类型实现重建方法
1. 在 `UserSelectedFileSourceFactory` 中添加静态 `rebuildSource` 方法
2. 在 `RemoteFileSourceFactory` 中添加静态 `rebuildSource` 方法
3. 在各自的工厂中实现具体的重建逻辑

### 第四步：简化主函数
1. 修改 `rebuildMediaItems` 函数，使用 `DataSourceRebuildDispatcher.rebuildDataSource()`
2. 调度器根据数据源类型自动调用对应工厂的重建方法

### 第五步：测试验证
1. 测试用户选择文件的重建
2. 测试远程文件存在时的重建
3. 测试远程文件缺失时的处理
4. 测试错误处理机制

## 预期效果

### 功能改进
1. **正确的数据源**：使用项目配置中保存的媒体项目作为重建依据
2. **真正的面向对象设计**：每个数据源负责自己的重建逻辑，实现多态
3. **零分支判断**：`rebuildMediaItems` 函数完全没有类型判断，调用统一接口
4. **自动恢复**：远程文件缺失时可以标记为需要重新下载
5. **错误处理**：重建失败的媒体项目会显示错误状态，便于用户识别和处理
6. **代码极简**：主函数逻辑非常清晰，只关注业务流程

### 用户体验提升
1. 项目加载更加可靠
2. 缺失的远程文件可以被识别和重新下载
3. 重建失败的文件有明确的错误提示
4. 支持多种数据源类型的项目

## 风险评估

### 兼容性风险
- **低风险**：新方案向后兼容，不会影响现有项目的加载

### 性能影响
- **轻微影响**：增加了数据源类型判断，但对整体性能影响很小

### 实现复杂度
- **中等复杂度**：需要在多个文件中添加新的函数，但逻辑清晰

## 后续扩展

该重构方案为未来支持更多数据源类型（如云存储、CDN等）奠定了基础，只需要：

1. 添加新的数据源类型定义
2. 在该类型中实现 `rebuildSource` 方法
3. 无需修改 `rebuildMediaItems` 函数或任何调用方代码

这是真正的开闭原则实现：对扩展开放，对修改封闭。整个架构具有优秀的可扩展性和维护性。