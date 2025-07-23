# 统一数据源系统

基于"核心数据与行为分离"的响应式重构方案，提供统一的媒体文件获取抽象层。

## 🎯 设计理念

### 职责分离
- **数据源数据**：纯响应式状态对象，存储所有状态信息
- **行为函数**：无状态函数，处理数据源操作逻辑
- **查询函数**：无状态函数，提供状态查询和计算
- **数据源管理器**：专注任务调度、并发控制、资源管理

### 响应式优先
- 所有数据源状态变化自动触发UI更新
- 完美支持Vue3响应式系统
- 无需手动回调机制

## 📁 文件结构

```
frontend/src/unified/
├── BaseDataSource.ts              # 基础数据源类型定义
├── UserSelectedFileSource.ts      # 用户选择文件数据源
├── RemoteFileSource.ts           # 远程文件数据源
├── BaseDataSourceManager.ts      # 管理器基础抽象类
├── UserSelectedFileManager.ts    # 用户选择文件管理器
├── RemoteFileManager.ts          # 远程文件管理器
├── DataSourceManagerRegistry.ts  # 管理器注册中心
├── index.ts                      # 统一导出文件
└── README.md                     # 使用说明
```

## 🚀 快速开始

### 1. 用户选择文件

```typescript
import { DataSourceFactory, startDataSourceAcquisition } from '@/unified'

// 创建数据源
const source = DataSourceFactory.createUserSelectedSource(file)

// 开始获取
startDataSourceAcquisition(source)

// 监听状态变化（Vue组件中）
watch(() => source.status, (newStatus) => {
  if (newStatus === 'acquired') {
    console.log('文件获取成功:', source.file, source.url)
  } else if (newStatus === 'error') {
    console.error('文件获取失败:', source.errorMessage)
  }
})
```

### 2. 远程文件下载

```typescript
import { DataSourceFactory, startDataSourceAcquisition } from '@/unified'

// 创建数据源
const source = DataSourceFactory.createRemoteSource('https://example.com/video.mp4', {
  timeout: 30000,
  retryCount: 3
})

// 开始下载
startDataSourceAcquisition(source)

// 监听下载进度
watch(() => source.progress, (progress) => {
  console.log(`下载进度: ${progress}%`)
})
```

## 📊 状态管理

### 数据源状态
- `pending`: 等待开始
- `acquiring`: 获取中
- `acquired`: 已获取
- `error`: 错误
- `cancelled`: 已取消
- `missing`: 缺失

### 状态映射
数据源状态会自动映射到媒体状态：
```typescript
'pending'    → 'pending'
'acquiring'  → 'asyncprocessing'
'acquired'   → 'webavdecoding'
'error'      → 'error'
'cancelled'  → 'cancelled'
'missing'    → 'missing'
```

## 🔧 管理器操作

### 获取管理器统计
```typescript
import { getManagerRegistry } from '@/unified'

const registry = getManagerRegistry()
const systemStats = registry.getSystemStats()
console.log('系统统计:', systemStats)
```

### 批量处理文件
```typescript
import { UserSelectedFileManager } from '@/unified'

const manager = UserSelectedFileManager.getInstance()
const result = await manager.processBatchFiles(files)
console.log('成功:', result.successful.length)
console.log('失败:', result.failed.length)
```

### 下载管理
```typescript
import { RemoteFileManager } from '@/unified'

const manager = RemoteFileManager.getInstance()

// 批量下载
const result = await manager.downloadBatchFiles(urls)

// 获取下载进度
const progress = manager.getActiveDownloadProgress()

// 暂停所有下载
manager.pauseAllDownloads()
```

## 🔍 查询和验证

### 类型查询
```typescript
import { DataSourceQueries, UserSelectedFileQueries } from '@/unified'

if (DataSourceQueries.isUserSelectedSource(source)) {
  const fileInfo = UserSelectedFileQueries.getFileInfo(source)
  const isVideo = UserSelectedFileQueries.isVideoFile(source)
}
```

### 文件验证
```typescript
import { UserSelectedFileActions } from '@/unified'

const validation = UserSelectedFileActions.validateFile(file)
if (!validation.isValid) {
  console.error('验证失败:', validation.errorMessage)
}
```

## 🎨 支持的文件类型

### 视频文件
- MP4, WebM, OGG, AVI, MOV, WMV, FLV, MKV

### 音频文件
- MP3, WAV, OGG, AAC, FLAC, M4A, WMA

### 图片文件
- JPEG, JPG, PNG, GIF, WebP, BMP, SVG

## ⚙️ 配置选项

### 远程文件配置
```typescript
const config = {
  headers: { 'Authorization': 'Bearer token' },
  timeout: 30000,      // 30秒超时
  retryCount: 3,       // 重试3次
  retryDelay: 1000     // 重试延迟1秒
}

const source = DataSourceFactory.createRemoteSource(url, config)
```

### 管理器配置
```typescript
import { RemoteFileManager } from '@/unified'

const manager = RemoteFileManager.getInstance()
manager.updateConfig({
  maxConcurrentDownloads: 5,
  defaultTimeout: 60000
})
```

## 🔄 扩展性

系统设计支持轻松扩展新的数据源类型：

1. 定义新的数据接口（继承 `BaseDataSourceData`）
2. 实现对应的行为函数和查询函数
3. 创建专用管理器（继承 `DataSourceManager`）
4. 在注册中心注册新管理器

## 🐛 调试和诊断

### 健康检查
```typescript
import { getManagerRegistry } from '@/unified'

const registry = getManagerRegistry()
const health = registry.validateManagerHealth()
if (!health.healthy) {
  console.error('系统问题:', health.issues)
}
```

### 状态打印
```typescript
registry.printManagerStatus()
```

## 📝 最佳实践

1. **响应式监听**：使用Vue的`watch`监听状态变化
2. **错误处理**：始终检查`error`状态并处理错误信息
3. **资源清理**：及时清理已完成的任务和URL对象
4. **并发控制**：合理设置管理器的并发数限制
5. **类型安全**：使用类型守卫确保类型安全

## 🔗 相关文档

- [数据源基础类型设计](../../docs/重构文档/01-数据源基础类型设计.md)
- [数据源扩展类型设计](../../docs/重构文档/02-数据源扩展类型设计.md)
- [数据源管理器设计](../../docs/重构文档/04-数据源基础管理器类型设计.md)
