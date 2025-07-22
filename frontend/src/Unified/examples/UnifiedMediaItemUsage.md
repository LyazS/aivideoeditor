# UnifiedMediaItem 使用示例

## 概述

`UnifiedMediaItem` 现在采用了更清晰的架构设计：
- **UnifiedMediaItem 类**：核心媒体项目类，负责状态管理和业务逻辑
- **UnifiedMediaItemFactory 工厂类**：负责创建媒体项目的各种方法

## 基础使用

### 1. 创建用户选择的文件

```typescript
import { UnifiedMediaItemFactory } from '@/Unified'

// 单个文件
const mediaItem = await UnifiedMediaItemFactory.fromUserSelectedFile(file, {
  onStatusChanged: (oldStatus, newStatus, context) => {
    console.log(`状态变化: ${oldStatus} → ${newStatus}`)
    
    if (newStatus === 'ready') {
      console.log('媒体已就绪，可以使用')
    } else if (newStatus === 'error') {
      console.error('媒体处理失败:', context?.errorMessage)
    }
  }
})

// 批量文件
const mediaItems = await UnifiedMediaItemFactory.fromFileList(fileList, {
  concurrency: 3, // 并发数
  onProgress: (completed, total) => {
    console.log(`进度: ${completed}/${total}`)
  },
  onItemCreated: (item, index) => {
    console.log(`创建了第 ${index + 1} 个媒体项目: ${item.name}`)
  },
  onStatusChanged: (oldStatus, newStatus) => {
    // 统一的状态变化处理
  }
})
```

### 2. 创建远程文件

```typescript
// 单个远程文件
const remoteItem = await UnifiedMediaItemFactory.fromRemoteUrl(
  'https://example.com/video.mp4',
  {
    timeout: 30000,
    headers: {
      'Authorization': 'Bearer token'
    },
    retryCount: 3,
    onStatusChanged: (oldStatus, newStatus, context) => {
      if (newStatus === 'asyncprocessing' && context?.type === 'progress_update') {
        console.log(`下载进度: ${context.progress}%`)
      }
    }
  }
)

// 批量远程文件
const urls = [
  'https://example.com/video1.mp4',
  'https://example.com/video2.mp4',
  'https://example.com/audio1.mp3'
]

const remoteItems = await UnifiedMediaItemFactory.fromUrlList(urls, {
  concurrency: 2, // 远程文件建议较低并发
  timeout: 60000,
  onProgress: (completed, total) => {
    console.log(`下载完成: ${completed}/${total}`)
  }
})
```



## 高级使用

### 1. 文件类型验证

```typescript
// 检查文件是否支持
if (UnifiedMediaItemFactory.isSupportedFileType(file)) {
  const mediaType = UnifiedMediaItemFactory.inferMediaType(file)
  console.log(`文件类型: ${mediaType}`)
  
  const item = await UnifiedMediaItemFactory.fromUserSelectedFile(file)
} else {
  console.error('不支持的文件类型')
}
```

### 2. 状态管理

```typescript
const item = await UnifiedMediaItemFactory.fromUserSelectedFile(file)

// 查询状态
console.log('是否就绪:', item.isReady())
console.log('是否处理中:', item.isProcessing())
console.log('是否有错误:', item.hasError())

// 获取信息
console.log('文件URL:', item.getUrl())
console.log('时长:', item.getDuration())
console.log('进度:', item.getProgress())
console.log('尺寸:', item.getOriginalSize())

// 控制操作
if (item.isProcessing()) {
  item.cancel() // 取消处理
}

if (item.hasError()) {
  item.retry() // 重试
}
```

### 3. 状态转换监听

```typescript
const item = await UnifiedMediaItemFactory.fromUserSelectedFile(file, {
  onStatusChanged: (oldStatus, newStatus, context) => {
    switch (newStatus) {
      case 'pending':
        console.log('等待开始处理')
        break
        
      case 'asyncprocessing':
        console.log('正在获取文件...')
        if (context?.type === 'progress_update') {
          updateProgressBar(context.progress)
        }
        break
        
      case 'webavdecoding':
        console.log('正在解析媒体文件...')
        break
        
      case 'ready':
        console.log('媒体文件已就绪')
        hideLoadingIndicator()
        break
        
      case 'error':
        console.error('处理失败:', context?.errorMessage)
        showErrorMessage(context?.errorMessage)
        break
        
      case 'cancelled':
        console.log('用户取消了处理')
        break
    }
  }
})
```

## 扩展工厂方法

如果需要添加新的创建方式，可以扩展工厂类：

```typescript
// 扩展工厂类
export class ExtendedMediaItemFactory extends UnifiedMediaItemFactory {
  
  /**
   * 从剪贴板创建媒体项目
   */
  static async fromClipboard(): Promise<UnifiedMediaItem> {
    const clipboardItems = await navigator.clipboard.read()
    
    for (const item of clipboardItems) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type)
          const file = new File([blob], 'clipboard-image', { type })
          return this.fromUserSelectedFile(file)
        }
      }
    }
    
    throw new Error('剪贴板中没有支持的媒体文件')
  }
  
  /**
   * 从摄像头创建媒体项目
   */
  static async fromCamera(constraints?: MediaStreamConstraints): Promise<UnifiedMediaItem> {
    const stream = await navigator.mediaDevices.getUserMedia(
      constraints || { video: true, audio: true }
    )
    
    // 创建自定义数据源
    const source = new CameraStreamSource(stream)
    
    return new UnifiedMediaItem(
      generateUUID4(),
      'camera-recording',
      source,
      { mediaType: 'video' }
    )
  }
}
```

## 最佳实践

1. **使用工厂方法创建**：始终通过工厂方法创建媒体项目，不要直接 `new UnifiedMediaItem()`
2. **监听状态变化**：设置 `onStatusChanged` 回调来处理状态变化
3. **控制并发数**：批量创建时合理设置并发数，避免资源过载
4. **错误处理**：妥善处理各种错误状态，提供用户友好的错误信息
5. **资源清理**：在组件卸载时取消正在进行的处理任务

## Vue 组件中的使用

```vue
<template>
  <div>
    <input type="file" multiple @change="handleFileSelect" />
    <div v-for="item in mediaItems" :key="item.id">
      <div>{{ item.name }} - {{ item.mediaStatus }}</div>
      <div v-if="item.isProcessing()">
        进度: {{ Math.round((item.getProgress() || 0) * 100) }}%
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { UnifiedMediaItemFactory, type UnifiedMediaItem } from '@/Unified'

const mediaItems = ref<UnifiedMediaItem[]>([])

const handleFileSelect = async (event: Event) => {
  const files = (event.target as HTMLInputElement).files
  if (!files) return
  
  const newItems = await UnifiedMediaItemFactory.fromFileList(files, {
    onStatusChanged: (oldStatus, newStatus) => {
      // 触发响应式更新
      mediaItems.value = [...mediaItems.value]
    }
  })
  
  mediaItems.value.push(...newItems)
}
</script>
```
