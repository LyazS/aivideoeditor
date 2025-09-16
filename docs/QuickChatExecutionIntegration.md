# QuickChatPopup集成代码执行功能设计方案

## 概述

本文档描述如何将现有的QuickChatPopup组件从聊天功能改造为支持JavaScript代码输入和执行的功能，使用VideoEditExecutionSystem来安全执行音视频编辑操作。

## 设计原则

- **极简改动**：最小化对现有代码的修改
- **零样式破坏**：完全复用现有UI样式
- **安全执行**：使用Web Worker沙箱环境
- **直观反馈**：清晰的执行结果提示

## 核心修改方案

### 1. 导入依赖

在现有导入基础上添加：

```typescript
import { useVideoEditExecutionSystem } from '@/agent/useVideoEditExecutionSystem'
import { unifiedStore } from '@/unified/unifiedStore'
```

### 2. 状态管理

添加执行状态：

```typescript
// 添加执行状态
const isExecuting = ref(false)
```

### 3. 执行系统初始化

创建执行实例：

```typescript
// 创建执行实例
const { executeUserScript } = useVideoEditExecutionSystem({
  historyModule: unifiedStore.historyModule,
  timelineModule: unifiedStore.timelineModule,
  webavModule: unifiedStore.webavModule,
  mediaModule: unifiedStore.mediaModule,
  configModule: unifiedStore.configModule,
  trackModule: unifiedStore.trackModule,
  selectionModule: unifiedStore.selectionModule,
})
```

### 4. 核心执行函数

替换原有的发送逻辑：

```typescript
async function executeCode() {
  const trimmedCode = message.value.trim()
  if (!trimmedCode || isExecuting.value) return

  isExecuting.value = true
  try {
    const result = await executeUserScript(trimmedCode, 5000, true)
    
    // 简单反馈显示在输入框中
    if (result.success) {
      message.value = `✅ 成功执行 ${result.executedCount} 个操作`
    } else {
      message.value = `❌ 失败: ${result.errorCount} 个错误`
    }
    
    // 2秒后清空，方便重新输入
    setTimeout(() => {
      if (!isExecuting.value) message.value = ''
    }, 2000)
  } catch (error) {
    message.value = `❌ 执行异常: ${error instanceof Error ? error.message : String(error)}`
  } finally {
    isExecuting.value = false
  }
}
```

### 5. 按键处理修改

更新Enter键行为：

```typescript
// 修改Enter键处理
const handleEnterKey = (event: KeyboardEvent) => {
  if (event.ctrlKey && event.key === 'Enter') {
    event.preventDefault()
    executeCode()
  }
  // Enter保持换行功能（原有逻辑）
}
```

### 6. UI文本更新

修改按钮显示：

```html
<button class="send-btn" @click="executeCode" :disabled="!message.trim() || isExecuting">
  {{ isExecuting ? '执行中...' : '执行代码' }}
</button>
```

修改输入框占位符：

```html
<textarea
  ref="textInput"
  v-model="message"
  class="message-input"
  placeholder="请输入JavaScript代码，例如：addTrack('video')"
  @keydown.enter.prevent="handleEnterKey"
></textarea>
```

## 使用方式

### 代码输入示例

```javascript
// 添加视频轨道和项目
addTrack("video")
addTimelineItem({
  mediaItemId: "video-1",
  trackId: "track-1", 
  timeRange: {
    start: "00:00:00.00", 
    end: "00:00:10.00"
  }
})

// 添加文本
addTrack("text")
addTimelineItem({
  mediaItemId: "text-1",
  trackId: "track-2",
  timeRange: {
    start: "00:00:02.00",
    end: "00:00:08.00"
  }
})
updateTextContent("text-1", "Hello World", {
  fontSize: 24,
  color: "#ffffff"
})
```

### 操作快捷键

- `Ctrl+Enter`: 执行代码
- `Enter`: 换行输入
- 点击"执行代码"按钮

### 执行反馈

- **成功**: `✅ 成功执行 X 个操作`
- **失败**: `❌ 失败: X 个错误`  
- **异常**: `❌ 执行异常: 错误信息`

## 安全特性

1. **Web Worker沙箱执行**：用户代码在独立线程中运行
2. **5秒超时保护**：防止死循环和长时间执行
3. **参数验证**：所有操作配置都会经过验证
4. **错误隔离**：执行失败不会影响主应用

## 实施步骤

1. 在QuickChatPopup.vue中添加导语句
2. 添加isExecuting状态变量
3. 创建executeUserScript实例
4. 替换sendMessage函数为executeCode函数
5. 修改handleEnterKey函数
6. 更新按钮文本绑定
7. 修改输入框占位符文本

## 代码示例模板

提供几个常用的代码模板：

### 基础项目创建
```javascript
addTrack("video", 0)
addTrack("audio", 1)
addTimelineItem({
  mediaItemId: "video-1",
  trackId: "track-1",
  timeRange: { start: "00:00:00.00", end: "00:01:00.00" }
})
```

### 文本叠加
```javascript
addTrack("text", 2)
addTimelineItem({
  mediaItemId: "text-1", 
  trackId: "track-3",
  timeRange: { start: "00:00:05.00", end: "00:00:15.00" }
})
updateTextContent("text-1", "标题文字", {
  fontSize: 36,
  color: "#ffffff",
  textAlign: "center"
})
```

### 关键帧动画
```javascript
createKeyframe("video-1", "00:00:01.00")
createKeyframe("video-1", "00:00:05.00") 
updateKeyframeProperty("video-1", "00:00:01.00", "opacity", 0)
updateKeyframeProperty("video-1", "00:00:05.00", "opacity", 1)
```

## 优势

1. **极简改动** - 只需要替换3-4个核心函数
2. **零样式破坏** - 完全复用现有UI
3. **安全执行** - Web Worker沙箱环境，5秒超时保护
4. **友好反馈** - 直观的执行结果显示
5. **即时可用** - 不需要额外依赖或配置

## 注意事项

1. 输入框大小适合短代码片段，复杂脚本建议使用专门的编辑器
2. 执行结果会暂时覆盖输入内容，2秒后自动清空
3. 长时间运行的代码会自动超时（5秒）
4. 所有操作都会经过参数验证，无效的API调用会返回错误

这个设计方案让您可以直接在现有的QuickChatPopup中输入JS代码并安全执行，界面保持简洁，功能实现完整。