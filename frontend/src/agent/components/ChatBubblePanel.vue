<template>
  <div class="panel">
    <!-- 顶部标题栏 -->
    <div class="panel-header">
      <div class="header-left">
        <RemixIcon name="sparkling-2-fill" size="md" />
        <h3>{{ t('common.chat.agent') }}</h3>
      </div>

      <div class="header-buttons">
        <HoverButton>
          <template #icon>
            <RemixIcon name="history-line" size="lg" />
          </template>
        </HoverButton>
        <HoverButton @click="$emit('close')" :title="t('common.close')">
          <template #icon>
            <RemixIcon name="close-line" size="lg" />
          </template>
        </HoverButton>
      </div>
    </div>

    <!-- 消息列表 -->
    <ChatMessageList :messages="messages" />

    <!-- 底部输入框 -->
    <ChatInput
      :placeholder="t('common.chat.inputPlaceholder')"
      :send-title="t('common.chat.send')"
      @send="handleSendMessage"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import RemixIcon from '@/components/icons/RemixIcon.vue'
import HoverButton from '@/components/HoverButton.vue'
import ChatMessageList from '@/agent/components/ChatMessageList.vue'
import ChatInput from '@/agent/components/ChatInput.vue'
import { useAppI18n } from '@/unified/composables/useI18n'
import type { ChatMessage } from './types'

const { t } = useAppI18n()

// 定义事件
const emit = defineEmits<{
  close: []
}>()

// 消息列表
const messages = ref<ChatMessage[]>([
  {
    id: '1',
    type: 'ai',
    content: `你好！我是AI助手，可以帮助你分析视频内容、提供编辑建议等。

## 我可以帮你做什么：

- **视频分析**：识别视频中的场景、物体和人物
- **编辑建议**：提供专业的视频编辑建议
- **效果推荐**：推荐适合的过渡效果和滤镜
- **音频处理**：音频优化和背景音乐建议

### 支持的格式示例：

**Markdown 格式支持：**
- 标题、列表、表格、代码块
- 引用、链接、图片
- 任务清单、强调文本

**XML 工具标签：**
- 文件搜索、读取、列表
- 项目分析和处理

有什么可以帮助你的吗？`,
    timestamp: '10:00',
  },
  {
    id: '2',
    type: 'user',
    content: '请展示 XML 工具的使用示例',
    timestamp: '10:01',
  },
  {
    id: '3',
    type: 'ai',
    content: `## XML 工具使用示例

我可以帮你使用各种 XML 工具来分析和处理项目文件：

### 🔧 标准工具示例：

**1. 搜索文件：**
<search_contents>
<path>src</path>
<regex>function.*test</regex>
<file_pattern>*.ts</file_pattern>
</search_contents>

**2. 读取文件：**
<read_content>
<path>/Users/airzostorm/Documents/aivideoeditor/package.json</path>
<start_line>1</start_line>
<end_line>20</end_line>
</read_content>

**3. 列出目录：**
<list_contents>
<path>/Users/airzostorm/Documents/aivideoeditor/src/components</path>
<recursive>true</recursive>
</list_contents>

### 📋 可用的 XML 工具：

1. **search_contents** - 搜索文件内容
2. **read_content** - 读取文件内容
3. **list_contents** - 列出目录文件

### 🎯 使用场景：

- 📁 **文件管理**：查找特定类型的文件
- 🔍 **代码搜索**：搜索特定的代码模式
- 📖 **文档查看**：读取配置文件或文档

需要我帮你使用这些工具吗？`,
    timestamp: '10:02',
  },
])

// 简单的AI回复逻辑
const getAIResponse = (userInput: string): string => {
  // 根据输入内容返回相关回复
  if (userInput.includes('xml') || userInput.includes('工具')) {
    return `## XML 工具使用指南

我可以帮你使用各种 XML 工具来分析和处理项目！

### 🔧 标准工具示例：

**1. 搜索文件：**
<search_contents>
<path>src</path>
<regex>function.*test</regex>
<file_pattern>*.ts</file_pattern>
</search_contents>

**2. 读取文件：**
<read_content>
<path>/Users/airzostorm/Documents/aivideoeditor/package.json</path>
<start_line>1</start_line>
<end_line>20</end_line>
</read_content>

**3. 列出目录：**
<list_contents>
<path>/Users/airzostorm/Documents/aivideoeditor/src/components</path>
<recursive>true</recursive>
</list_contents>

### ⚠️ 错误使用示例：

**1. 缺少必需参数：**
<search_contents>
<path>src</path>
</search_contents>

**2. 行号逻辑错误：**
<read_content>
<path>/Users/airzostorm/Documents/aivideoeditor/README.md</path>
<start_line>50</start_line>
<end_line>10</end_line>
</read_content>

### 📋 可用的 XML 工具：

1. **search_contents** - 搜索文件内容
2. **read_content** - 读取文件内容
3. **list_contents** - 列出目录文件

### 🎯 使用场景：

- 📁 **文件管理**：查找特定类型的文件
- 🔍 **代码搜索**：搜索特定的代码模式
- 📖 **文档查看**：读取配置文件或文档

需要我帮你使用这些工具吗？`
  } else if (userInput.includes('markdown') || userInput.includes('格式')) {
    return `## Markdown 格式支持

我支持各种 Markdown 格式来让回复更清晰：

### 📝 基础格式：

**标题：**
# 一级标题
## 二级标题
### 三级标题

**列表：**
- 无序列表项
- 另一个项目
  - 子项目

**强调：**
- *斜体文本*
- **粗体文本**
- \`代码片段\`

### 📊 高级格式：

**表格：**
| 工具名称 | 功能描述 | 使用场景 |
|----------|----------|----------|
| search_contents | 搜索文件 | 代码查找 |
| read_content | 读取文件 | 文档查看 |
| list_contents | 列出目录 | 文件管理 |

**代码块：**
\`\`\`javascript
// JavaScript 代码示例
const example = () => {
  console.log('Hello World!');
};
\`\`\`

**引用：**
> 这是一个引用块
> 可以包含重要提示

需要我展示其他格式吗？`
  } else {
    return `## 示例回复

这是一个使用 **Markdown** 格式的示例回复：

### 主要功能：
- ✅ 支持各种文本格式
- ✅ 可以包含代码示例
- ✅ 支持表格和列表

\`\`\`javascript
// 代码示例
const example = "Hello World";
\`\`\`

需要了解 **XML 工具** 或 **Markdown 格式** 的更多信息吗？`
  }
}

// 处理发送消息
const handleSendMessage = (message: string) => {
  // 添加用户消息
  const userMessage: ChatMessage = {
    id: Date.now().toString(),
    type: 'user',
    content: message,
    timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
  }

  messages.value.push(userMessage)

  // 模拟AI回复
  setTimeout(() => {
    const aiMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: 'ai',
      content: getAIResponse(message),
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    }
    messages.value.push(aiMessage)
  }, 1000)
}
</script>

<style scoped>
/* 确保聊天面板占满整个高度 */
.panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
