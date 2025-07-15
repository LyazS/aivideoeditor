# 错误状态媒体项持久化修正方案

## 问题分析

### 当前问题
当webav无法解析导入的媒体时，会在素材区留下一个错误状态的媒体项，但这个错误状态没有持久化。虽然没有实际文件，但应该保留状态在素材区，以便后续扩展重新导入等功能。

### 问题根因
1. **错误状态媒体项确实会被创建**：在 `MediaLibrary.vue` 中，当webav解析失败时，会创建 `status: 'error'` 的 `LocalMediaItem`
2. **UI显示正常**：错误状态的媒体项在UI中有专门的显示逻辑（红色X图标）
3. **持久化缺失**：关键问题在于错误状态的媒体项没有被持久化，因为：
   - 错误状态的媒体项没有成功的webav clip，不会调用 `mediaManager.importMediaFiles()`
   - 没有调用 `importMediaFiles()` 就不会创建 `LocalMediaReference`
   - 没有 `LocalMediaReference` 就不会被保存到项目文件中
   - 项目重新加载时，这些错误状态的媒体项就消失了

## 修正方案设计

### 方案选择：统一MediaReference管理（推荐）

基于现有架构分析，推荐**扩展现有的LocalMediaReference**而不是创建单独的ErrorMediaReference，原因：

1. **架构一致性**：符合现有的设计模式（如localMediaReferences和asyncProcessingMediaReferences的分离方式）
2. **代码简洁性**：减少重复的管理逻辑，统一处理流程
3. **扩展性好**：未来可以轻松添加更多状态类型
4. **维护成本低**：只需要维护一套引用管理系统

### 核心设计思路

**即使webav解析失败，也要为媒体项创建持久化记录**，这样用户就不会丢失导入失败的媒体信息，并且为将来的功能扩展（如重新导入、格式转换等）留下了接口。

## 具体实现方案

### 1. 扩展类型定义

```typescript
// 扩展现有的LocalMediaReference类型
export interface LocalMediaReference extends BaseMediaReference {
  type: MediaType
  storedPath: string
  
  // 新增状态管理字段
  status?: 'normal' | 'error'  // 默认为normal
  
  // 错误状态相关字段（仅当status为error时有值）
  errorType?: 'webav_parse_error' | 'file_load_error' | 'unsupported_format'
  errorMessage?: string
  errorTimestamp?: string
  
  // 保留原始文件信息用于重试
  originalFile?: {
    name: string
    size: number
    type: string
    lastModified: number
  }
}
```

### 2. 修改媒体导入错误处理逻辑

在 `MediaLibrary.vue` 的错误处理部分添加错误引用保存：

```typescript
// 在addVideoItem, addImageItem, addAudioItem的catch块中
catch (error) {
  const processingTime = ((Date.now() - startTime) / 1000).toFixed(2)
  console.error(`❌ [并发处理] 媒体文件处理失败: ${file.name} (耗时: ${processingTime}s)`, error)

  // 创建错误状态的媒体项
  const errorMediaItem: LocalMediaItem = {
    ...parsingMediaItem,
    isReady: false,
    status: 'error',
    mp4Clip: null, // 或对应的clip类型
    duration: 0,
    thumbnailUrl: undefined
  }

  console.log(`🔴 [并发处理] 媒体文件转换失败，设置为错误状态: ${file.name}`)
  videoStore.updateLocalMediaItem(errorMediaItem)

  // 新增：保存错误状态的媒体引用
  if (videoStore.currentProjectId) {
    try {
      const errorReference: LocalMediaReference = {
        originalFileName: file.name,
        storedPath: '', // 错误状态没有实际文件
        type: mediaType,
        fileSize: file.size,
        checksum: '', // 错误状态没有校验和
        status: 'error',
        errorType: 'webav_parse_error',
        errorMessage: error.message,
        errorTimestamp: new Date().toISOString(),
        originalFile: {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified
        }
      }
      
      videoStore.addMediaReference(mediaItemId, errorReference)
      console.log(`💾 错误状态媒体引用已保存: ${file.name}`)
    } catch (referenceError) {
      console.warn('保存错误状态媒体引用失败:', referenceError)
    }
  }

  resolve()
}
```

### 3. 修改MediaManager加载逻辑

扩展 `MediaManager.ts` 中的加载方法以支持错误状态媒体项：

```typescript
/**
 * 加载项目的所有媒体文件（包括错误状态的媒体项）
 */
async loadAllMediaForProject(
  projectId: string,
  mediaReferences: Record<string, LocalMediaReference>,
  options: LoadMediaOptions = {}
): Promise<LocalMediaItem[]> {
  const loadedItems: LocalMediaItem[] = []
  
  for (const [mediaId, reference] of Object.entries(mediaReferences)) {
    if (reference.status === 'error') {
      // 创建错误状态的媒体项占位符
      const errorMediaItem: LocalMediaItem = {
        id: mediaId,
        name: reference.originalFileName,
        createdAt: reference.errorTimestamp || new Date().toISOString(),
        file: null as any, // 错误状态没有实际文件
        url: '',
        duration: 0,
        type: reference.originalFile?.type || '',
        mediaType: reference.type,
        mp4Clip: null,
        imgClip: null,
        audioClip: null,
        isReady: false,
        status: 'error'
      }
      
      loadedItems.push(errorMediaItem)
      console.log(`🔴 恢复错误状态媒体项: ${reference.originalFileName}`)
    } else {
      // 正常加载流程
      try {
        const mediaItem = await this.rebuildMediaItemFromLocal(mediaId, reference, projectId)
        loadedItems.push(mediaItem)
      } catch (error) {
        // 加载失败，转换为错误状态
        console.error(`加载媒体失败，转换为错误状态: ${reference.originalFileName}`, error)
        
        // 更新引用状态
        reference.status = 'error'
        reference.errorType = 'file_load_error'
        reference.errorMessage = error.message
        reference.errorTimestamp = new Date().toISOString()
        
        // 创建错误状态媒体项
        const errorMediaItem: LocalMediaItem = {
          id: mediaId,
          name: reference.originalFileName,
          createdAt: new Date().toISOString(),
          file: null as any,
          url: '',
          duration: 0,
          type: reference.originalFile?.type || '',
          mediaType: reference.type,
          mp4Clip: null,
          imgClip: null,
          audioClip: null,
          isReady: false,
          status: 'error'
        }
        
        loadedItems.push(errorMediaItem)
      }
    }
  }
  
  return loadedItems
}

/**
 * 保存错误状态媒体引用
 */
async saveErrorMediaReference(
  mediaId: string,
  file: File,
  projectId: string,
  mediaType: MediaType,
  errorType: 'webav_parse_error' | 'file_load_error' | 'unsupported_format',
  errorMessage: string
): Promise<LocalMediaReference> {
  const errorReference: LocalMediaReference = {
    originalFileName: file.name,
    storedPath: '', // 错误状态没有实际存储路径
    type: mediaType,
    fileSize: file.size,
    checksum: '', // 错误状态没有校验和
    status: 'error',
    errorType,
    errorMessage,
    errorTimestamp: new Date().toISOString(),
    originalFile: {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    }
  }
  
  console.log(`💾 保存错误状态媒体引用: ${file.name}`)
  return errorReference
}
```

### 4. 数据流程

```
用户导入媒体 → webav解析失败 → 创建错误状态LocalMediaItem → 创建错误状态LocalMediaReference → 保存到项目配置
                                    ↓
项目重新加载 ← 恢复错误状态MediaItem ← 从项目配置读取错误状态LocalMediaReference
```

## 实现优先级

### 高优先级（核心功能）
1. **扩展LocalMediaReference类型定义**
2. **修改MediaLibrary.vue错误处理逻辑**
3. **扩展MediaManager加载方法**
4. **确保项目保存/加载包含错误状态引用**

### 中优先级（用户体验）
1. **错误状态媒体项的UI优化**
2. **错误信息的详细显示**
3. **项目加载时的错误状态恢复**

### 低优先级（功能扩展）
1. **重试功能**：为错误状态媒体项添加"重新导入"按钮
2. **错误详情**：显示具体的错误信息和建议
3. **批量清理**：清理长期错误状态的媒体项

## 预期效果

实现后的用户体验：

1. **导入失败时**：媒体项显示红色错误状态，但保留在素材区
2. **项目保存时**：错误状态的媒体项信息被保存到项目文件
3. **项目重新打开时**：错误状态的媒体项被正确恢复，用户可以看到之前导入失败的文件
4. **未来扩展**：可以为错误状态的媒体项添加重试、删除、查看详情等功能

## 技术优势

1. **数据完整性**：不会丢失用户的导入尝试记录
2. **用户体验**：用户清楚知道哪些文件导入失败了
3. **扩展性**：为未来的重试、格式转换等功能奠定基础
4. **一致性**：与现有的媒体引用管理系统保持一致
5. **简洁性**：避免了额外的错误媒体引用管理复杂度

## 详细实现步骤

### 步骤1：修改类型定义文件

在 `frontend/src/types/index.ts` 中扩展 `LocalMediaReference` 接口：

```typescript
/**
 * 本地媒体引用接口 - 继承基础接口，添加本地文件相关属性
 * 扩展支持错误状态持久化
 */
export interface LocalMediaReference extends BaseMediaReference {
  type: MediaType
  storedPath: string // 正常状态：实际存储路径；错误状态：空字符串

  // 新增：状态管理字段
  status?: 'normal' | 'error'  // 默认为normal，兼容现有数据

  // 新增：错误状态相关字段（仅当status为error时有值）
  errorType?: 'webav_parse_error' | 'file_load_error' | 'unsupported_format'
  errorMessage?: string
  errorTimestamp?: string

  // 新增：保留原始文件信息用于重试功能
  originalFile?: {
    name: string
    size: number
    type: string
    lastModified: number
  }
}

/**
 * 错误类型枚举说明
 */
export type MediaErrorType =
  | 'webav_parse_error'    // WebAV解析失败（如格式不支持、文件损坏）
  | 'file_load_error'      // 文件加载失败（如文件不存在、权限问题）
  | 'unsupported_format'   // 不支持的文件格式
```

### 步骤2：修改MediaLibrary.vue错误处理

在 `frontend/src/components/MediaLibrary.vue` 中修改错误处理逻辑：

```typescript
// 在addVideoItem的catch块中添加
catch (error) {
  const processingTime = ((Date.now() - startTime) / 1000).toFixed(2)
  console.error(`❌ [并发处理] 视频文件处理失败: ${file.name} (耗时: ${processingTime}s)`, error)

  // 创建错误状态的媒体项
  const errorMediaItem: LocalMediaItem = {
    ...parsingMediaItem,
    isReady: false,
    status: 'error',
    mp4Clip: null,
    duration: 0,
    thumbnailUrl: undefined
  }

  console.log(`🔴 [并发处理] 视频文件转换失败，设置为错误状态: ${file.name}`)
  videoStore.updateLocalMediaItem(errorMediaItem)

  // 新增：保存错误状态的媒体引用到项目
  await saveErrorMediaReference(mediaItemId, file, 'video', 'webav_parse_error', error.message)

  resolve()
}

// 新增：保存错误媒体引用的辅助函数
const saveErrorMediaReference = async (
  mediaItemId: string,
  file: File,
  mediaType: MediaType,
  errorType: MediaErrorType,
  errorMessage: string
) => {
  if (!videoStore.currentProjectId) {
    console.warn('没有当前项目，跳过错误媒体引用保存')
    return
  }

  try {
    const { MediaManager } = await import('../utils/MediaManager')
    const mediaManager = MediaManager.getInstance()

    const errorReference = await mediaManager.saveErrorMediaReference(
      mediaItemId,
      file,
      videoStore.currentProjectId,
      mediaType,
      errorType,
      errorMessage
    )

    videoStore.addMediaReference(mediaItemId, errorReference)
    console.log(`💾 错误状态媒体引用已保存: ${file.name}`)
  } catch (referenceError) {
    console.warn(`保存错误状态媒体引用失败: ${file.name}`, referenceError)
    // 不阻断用户操作，只记录警告
  }
}
```

### 步骤3：扩展MediaManager功能

在 `frontend/src/utils/MediaManager.ts` 中添加错误媒体引用处理：

```typescript
/**
 * 保存错误状态媒体引用
 * @param mediaId 媒体ID
 * @param file 原始文件对象
 * @param projectId 项目ID
 * @param mediaType 媒体类型
 * @param errorType 错误类型
 * @param errorMessage 错误信息
 * @returns 错误状态的媒体引用
 */
async saveErrorMediaReference(
  mediaId: string,
  file: File,
  projectId: string,
  mediaType: MediaType,
  errorType: MediaErrorType,
  errorMessage: string
): Promise<LocalMediaReference> {
  try {
    console.log(`💾 开始保存错误状态媒体引用: ${file.name}`)

    // 创建错误状态的媒体引用
    const errorReference: LocalMediaReference = {
      originalFileName: file.name,
      storedPath: '', // 错误状态没有实际存储路径
      type: mediaType,
      fileSize: file.size,
      checksum: '', // 错误状态没有文件校验和
      status: 'error',
      errorType,
      errorMessage,
      errorTimestamp: new Date().toISOString(),
      originalFile: {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      }
    }

    console.log(`✅ 错误状态媒体引用创建完成: ${file.name}`)
    return errorReference
  } catch (error) {
    console.error('保存错误状态媒体引用失败:', error)
    throw error
  }
}

/**
 * 加载项目的所有媒体文件（扩展支持错误状态媒体项）
 */
async loadAllMediaForProject(
  projectId: string,
  mediaReferences: Record<string, LocalMediaReference>,
  options: LoadMediaOptions = {}
): Promise<LocalMediaItem[]> {
  const { batchSize = 5, onProgress } = options
  const loadedItems: LocalMediaItem[] = []
  const referenceEntries = Object.entries(mediaReferences)

  console.log(`📁 开始加载项目媒体文件: ${referenceEntries.length}个引用`)

  for (let i = 0; i < referenceEntries.length; i += batchSize) {
    const batch = referenceEntries.slice(i, i + batchSize)

    const batchPromises = batch.map(async ([mediaId, reference]) => {
      if (reference.status === 'error') {
        // 恢复错误状态的媒体项
        return this.restoreErrorMediaItem(mediaId, reference)
      } else {
        // 正常加载流程
        try {
          return await this.rebuildMediaItemFromLocal(mediaId, reference, projectId)
        } catch (error) {
          console.error(`加载媒体失败，转换为错误状态: ${reference.originalFileName}`, error)

          // 将加载失败的媒体转换为错误状态
          const updatedReference: LocalMediaReference = {
            ...reference,
            status: 'error',
            errorType: 'file_load_error',
            errorMessage: error.message,
            errorTimestamp: new Date().toISOString()
          }

          return this.restoreErrorMediaItem(mediaId, updatedReference)
        }
      }
    })

    const batchResults = await Promise.all(batchPromises)
    loadedItems.push(...batchResults.filter(item => item !== null))

    // 报告进度
    onProgress?.(loadedItems.length, referenceEntries.length)
  }

  console.log(`✅ 媒体文件加载完成: ${loadedItems.length}个文件（包含错误状态）`)
  return loadedItems
}

/**
 * 恢复错误状态的媒体项
 * @param mediaId 媒体ID
 * @param reference 错误状态的媒体引用
 * @returns 错误状态的LocalMediaItem
 */
private restoreErrorMediaItem(
  mediaId: string,
  reference: LocalMediaReference
): LocalMediaItem {
  console.log(`🔴 恢复错误状态媒体项: ${reference.originalFileName}`)

  const errorMediaItem: LocalMediaItem = {
    id: mediaId,
    name: reference.originalFileName,
    createdAt: reference.errorTimestamp || new Date().toISOString(),
    file: null as any, // 错误状态没有实际文件对象
    url: '', // 错误状态没有URL
    duration: 0,
    type: reference.originalFile?.type || '',
    mediaType: reference.type,
    mp4Clip: null,
    imgClip: null,
    audioClip: null,
    isReady: false,
    status: 'error'
  }

  return errorMediaItem
}
```

### 步骤4：确保项目保存包含错误引用

确认 `frontend/src/stores/modules/projectModule.ts` 中的保存逻辑已包含所有媒体引用：

```typescript
/**
 * 保存当前项目（确保包含错误状态的媒体引用）
 */
async function saveCurrentProject(projectData?: Partial<ProjectConfig>): Promise<void> {
  if (!currentProject.value) {
    throw new Error('没有当前项目可保存')
  }

  try {
    isSaving.value = true
    console.log(`💾 保存项目: ${currentProject.value.name}`)

    // 合并项目数据，确保包含所有媒体引用（包括错误状态）
    const updatedProject: ProjectConfig = {
      ...currentProject.value,
      ...projectData,
      localMediaReferences: mediaReferences.value, // 包含正常和错误状态的引用
      asyncProcessingMediaReferences: {},
      updatedAt: new Date().toISOString()
    }

    await projectManager.saveProject(updatedProject)
    currentProject.value = updatedProject
    lastSaved.value = new Date()

    console.log(`✅ 项目保存成功: ${updatedProject.name}`)
    console.log(`📊 保存的媒体引用数量: ${Object.keys(mediaReferences.value).length}`)
  } catch (error) {
    console.error('保存项目失败:', error)
    throw error
  } finally {
    isSaving.value = false
  }
}
```

## 测试验证

### 测试场景1：导入失败的媒体文件
1. 导入一个损坏的视频文件
2. 验证素材区显示红色错误状态
3. 保存项目并重新打开
4. 验证错误状态的媒体项被正确恢复

### 测试场景2：项目加载时文件丢失
1. 导入正常媒体文件并保存项目
2. 手动删除项目目录中的媒体文件
3. 重新打开项目
4. 验证丢失的媒体文件显示为错误状态

### 测试场景3：混合状态项目
1. 项目中同时包含正常和错误状态的媒体项
2. 保存并重新打开项目
3. 验证所有媒体项状态正确恢复

## 后续扩展功能

### 重试功能
为错误状态的媒体项添加右键菜单：
- "重新导入"：重新选择文件进行导入
- "查看错误详情"：显示具体错误信息和建议
- "删除"：从项目中移除错误状态的媒体项

### 批量管理
- "清理所有错误项"：批量删除错误状态的媒体项
- "重试所有失败项"：批量重新导入错误状态的媒体项

### 错误分析
- 统计不同错误类型的分布
- 提供格式转换建议
- 显示支持的文件格式列表
