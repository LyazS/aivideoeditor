# 数据源管理器实现

## 概述

基于重构文档的统一异步源架构，实现了完整的数据源管理器系统。目前已实现 `UserSelectedFileManager`，用于处理用户选择文件的验证和处理。

## 架构设计

### 核心组件

1. **BaseDataSourceManager** - 基础抽象类
   - 提供统一的任务管理、并发控制、错误处理和重试机制
   - 所有具体管理器的基类

2. **DataSourceManagerRegistry** - 注册中心
   - 单例模式，统一管理所有管理器实例
   - 提供全局统计和操作功能

3. **UserSelectedFileManager** - 用户选择文件管理器
   - 处理文件验证、格式检查、URL创建
   - 支持视频、音频、图片文件类型

## 使用方法

### 1. 初始化管理器系统

```typescript
import { initDataSourceManagers } from '@/utils/dataSourceManagerInit'

// 在应用启动时调用
initDataSourceManagers()
```

### 2. 使用 UserSelectedFileSource

```typescript
import { UserSelectedFileSource } from '@/types/Unified'

// 处理用户选择的文件
const handleFileSelect = (file: File) => {
  const source = new UserSelectedFileSource(file, (source) => {
    const status = source.getStatus()
    const progress = source.getProgress()
    
    switch (status) {
      case 'acquiring':
        console.log(`验证中... ${progress}%`)
        break
      case 'acquired':
        console.log('文件验证成功')
        console.log('文件URL:', source.getUrl())
        console.log('文件对象:', source.getFile())
        break
      case 'error':
        console.error('验证失败:', source.getError())
        break
    }
  })
  
  // 开始验证
  source.startAcquisition()
}
```

### 3. 监控管理器状态

```typescript
import { UserSelectedFileManager } from '@/types/Unified'

const manager = UserSelectedFileManager.getInstance()

// 获取统计信息
const stats = manager.getStats()
console.log('总任务数:', stats.totalTasks)
console.log('运行中任务:', stats.runningTasks)
console.log('已完成任务:', stats.completedTasks)

// 清理已完成的任务
manager.cleanupCompletedTasks()
```

## 支持的文件类型

### 视频文件
- MP4 (`video/mp4`)
- WebM (`video/webm`)
- OGG (`video/ogg`)
- AVI (`video/avi`)
- MOV (`video/mov`, `video/quicktime`)
- WMV (`video/x-ms-wmv`)

### 音频文件
- MP3 (`audio/mp3`, `audio/mpeg`)
- WAV (`audio/wav`, `audio/x-wav`)
- OGG (`audio/ogg`)
- AAC (`audio/aac`)
- FLAC (`audio/flac`)

### 图片文件
- JPEG (`image/jpeg`, `image/jpg`)
- PNG (`image/png`)
- GIF (`image/gif`)
- WebP (`image/webp`)
- BMP (`image/bmp`)
- SVG (`image/svg+xml`)

## 配置选项

### 并发控制
```typescript
const manager = UserSelectedFileManager.getInstance()
manager.setMaxConcurrentTasks(5) // 设置最大并发任务数
```

### 文件大小限制
默认最大文件大小为 2GB，可以在 `UserSelectedFileManager` 中修改。

## 测试

### 自动测试
```typescript
import { testUserSelectedFileManager } from '@/utils/testUserSelectedFileManager'

// 运行完整测试套件
await testUserSelectedFileManager()
```

### 演示组件
使用 `UserSelectedFileManagerDemo.vue` 组件进行交互式测试：

```vue
<template>
  <UserSelectedFileManagerDemo />
</template>

<script setup>
import UserSelectedFileManagerDemo from '@/components/UserSelectedFileManagerDemo.vue'
</script>
```

## 开发调试

### 控制台调试
在开发环境下，测试函数会自动暴露到全局：

```javascript
// 在浏览器控制台中运行
window.testUserSelectedFileManager()
window.runUserSelectedFileManagerTests()
```

### 统计信息
```typescript
import { printGlobalManagerStats } from '@/types/Unified'

// 打印全局统计信息
printGlobalManagerStats()
```

## 扩展指南

### 添加新的数据源管理器

1. 继承 `BaseDataSourceManager`
2. 实现抽象方法 `executeTask` 和 `getManagerType`
3. 在初始化函数中注册管理器

```typescript
class MyCustomManager extends BaseDataSourceManager<MyCustomSource> {
  static getInstance(): MyCustomManager {
    // 单例实现
  }
  
  getManagerType(): string {
    return 'my-custom'
  }
  
  protected async executeTask(task: AcquisitionTask<MyCustomSource>): Promise<void> {
    // 实现具体逻辑
  }
}

// 注册管理器
registerManager('my-custom', MyCustomManager.getInstance())
```

## 注意事项

1. **内存管理**: 定期调用 `cleanupCompletedTasks()` 清理已完成的任务
2. **错误处理**: 所有异步操作都有适当的错误处理和重试机制
3. **并发控制**: 管理器会自动控制并发任务数，避免资源过度消耗
4. **文件URL**: 记得在不需要时调用 `URL.revokeObjectURL()` 释放内存

## 状态流转

```
pending → acquiring → acquired
   ↓         ↓
cancelled   error
```

- `pending`: 等待开始验证
- `acquiring`: 正在验证文件
- `acquired`: 验证成功，文件可用
- `error`: 验证失败
- `cancelled`: 用户取消操作
