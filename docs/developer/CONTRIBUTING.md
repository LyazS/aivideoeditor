# 贡献指南

## 📋 概述

欢迎为AI视频编辑器项目做出贡献！本指南将帮助您了解如何参与项目开发，包括代码贡献、问题报告、功能建议等。

## 🚀 快速开始

### 开发环境设置

#### 系统要求
- Node.js >= 18.0.0
- npm >= 8.0.0
- Git
- 现代浏览器（支持WebGL和Canvas API）

#### 项目设置
```bash
# 1. Fork并克隆项目
git clone https://github.com/your-username/aivideoeditor.git
cd aivideoeditor

# 2. 安装依赖
cd frontend
npm install

# 3. 启动开发服务器
npm run dev

# 4. 在浏览器中打开 http://localhost:5173
```

#### 开发工具配置
推荐使用以下VSCode插件：
- Vue Language Features (Volar)
- TypeScript Vue Plugin (Volar)
- ESLint
- Prettier
- Auto Rename Tag

## 🛠️ 开发流程

### 分支管理
- `main` - 主分支，包含稳定的生产代码
- `develop` - 开发分支，包含最新的开发代码
- `feature/*` - 功能分支，用于开发新功能
- `bugfix/*` - 修复分支，用于修复bug
- `hotfix/*` - 热修复分支，用于紧急修复

### 工作流程
1. **创建分支**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **开发和测试**
   - 编写代码
   - 运行测试
   - 确保代码质量

3. **提交代码**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   git push origin feature/your-feature-name
   ```

4. **创建Pull Request**
   - 在GitHub上创建PR
   - 填写详细的描述
   - 等待代码审查

## 📝 代码规范

### TypeScript规范
- 使用严格的TypeScript配置
- 为所有函数和变量提供类型注解
- 使用接口定义复杂的数据结构
- 避免使用`any`类型

```typescript
// ✅ 好的示例
interface TimelineItem {
  id: string
  mediaItemId: string
  timeRange: TimeRange
  transformProperties: TransformProperties
}

function createTimelineItem(data: TimelineItemData): TimelineItem {
  return {
    id: generateId(),
    mediaItemId: data.mediaItemId,
    timeRange: data.timeRange,
    transformProperties: data.transformProperties
  }
}

// ❌ 避免的示例
function createItem(data: any): any {
  return data
}
```

### Vue组件规范
- 使用Composition API
- 组件名使用PascalCase
- Props和Events使用明确的类型定义
- 使用`<script setup>`语法

```vue
<!-- ✅ 好的示例 -->
<template>
  <div class="video-clip" :class="{ selected: isSelected }">
    <!-- 组件内容 -->
  </div>
</template>

<script setup lang="ts">
interface Props {
  timelineItem: TimelineItem
  isSelected: boolean
}

interface Emits {
  select: [itemId: string]
  delete: [itemId: string]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
</script>
```

### CSS规范
- 使用BEM命名约定
- 使用CSS变量定义主题色彩
- 避免深层嵌套（最多3层）
- 使用语义化的类名

```scss
// ✅ 好的示例
.video-clip {
  &__content {
    padding: var(--spacing-sm);
  }
  
  &--selected {
    border-color: var(--color-primary);
  }
  
  &--dragging {
    opacity: 0.7;
  }
}
```

### 提交信息规范
使用[Conventional Commits](https://www.conventionalcommits.org/)规范：

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

类型说明：
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建工具或辅助工具的变动

示例：
```
feat(timeline): add multi-select functionality

- Implement Ctrl+click for multi-selection
- Add visual feedback for selected items
- Support batch operations on selected items

Closes #123
```

## 🧪 测试指南

### 测试策略
- **单元测试**: 测试独立的函数和组件
- **集成测试**: 测试组件间的交互
- **端到端测试**: 测试完整的用户流程

### 运行测试
```bash
# 运行所有测试
npm run test

# 运行特定测试文件
npm run test -- VideoClip.test.ts

# 运行测试并生成覆盖率报告
npm run test:coverage
```

### 测试编写指南
```typescript
// 组件测试示例
import { mount } from '@vue/test-utils'
import VideoClip from '@/components/VideoClip.vue'

describe('VideoClip', () => {
  it('should emit select event when clicked', async () => {
    const wrapper = mount(VideoClip, {
      props: {
        timelineItem: mockTimelineItem,
        isSelected: false
      }
    })
    
    await wrapper.trigger('click')
    
    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')[0]).toEqual([mockTimelineItem.id])
  })
})
```

## 🐛 问题报告

### 报告Bug
在GitHub Issues中创建bug报告时，请包含：

1. **问题描述**: 清晰描述遇到的问题
2. **重现步骤**: 详细的重现步骤
3. **预期行为**: 描述期望的正确行为
4. **实际行为**: 描述实际发生的情况
5. **环境信息**: 浏览器版本、操作系统等
6. **截图/视频**: 如果适用，提供视觉证据

### Bug报告模板
```markdown
## 问题描述
简要描述遇到的问题

## 重现步骤
1. 打开应用
2. 导入视频文件
3. 拖拽到时间轴
4. 点击播放按钮

## 预期行为
视频应该正常播放

## 实际行为
视频无法播放，控制台显示错误

## 环境信息
- 浏览器: Chrome 120.0.0.0
- 操作系统: Windows 11
- 项目版本: v1.0.0

## 附加信息
控制台错误信息、截图等
```

## 💡 功能建议

### 提交功能请求
在GitHub Issues中创建功能请求时，请包含：

1. **功能描述**: 详细描述建议的功能
2. **使用场景**: 说明功能的应用场景
3. **预期收益**: 描述功能带来的价值
4. **实现建议**: 如果有想法，可以提供实现建议
5. **替代方案**: 考虑其他可能的解决方案

## 📚 文档贡献

### 文档类型
- **用户文档**: 面向最终用户的使用指南
- **开发文档**: 面向开发者的技术文档
- **API文档**: 接口和函数的详细说明
- **功能文档**: 具体功能的实现说明

### 文档编写规范
- 使用清晰的标题层次
- 提供代码示例和截图
- 保持内容的准确性和时效性
- 使用一致的术语和格式

## 🎯 贡献领域

### 代码贡献
- 新功能开发
- Bug修复
- 性能优化
- 代码重构
- 测试覆盖

### 非代码贡献
- 文档改进
- 问题报告
- 功能建议
- 用户体验反馈
- 社区支持

## 🏆 贡献者认可

### 贡献统计
- 代码提交数量
- 问题解决数量
- 文档贡献
- 社区参与度

### 认可方式
- 贡献者列表
- 特殊徽章
- 社区感谢
- 项目推荐

## 📞 联系方式

### 获取帮助
- **GitHub Issues**: 报告问题和功能请求
- **GitHub Discussions**: 社区讨论和问答
- **Email**: 项目维护者邮箱

### 社区参与
- 参与代码审查
- 帮助新贡献者
- 分享使用经验
- 推广项目

---

感谢您对AI视频编辑器项目的贡献！每一个贡献都让项目变得更好。
