# 开发指南

## 开发环境设置

### 系统要求
- Node.js >= 18.0.0
- npm >= 8.0.0
- 现代浏览器（支持WebGL和Canvas API）

### 项目设置
```bash
# 克隆项目
git clone <repository-url>
cd aivideoeditor

# 安装依赖
cd frontend
npm install

# 启动开发服务器
npm run dev
```

### 开发工具配置

#### VSCode推荐插件
- Vue Language Features (Volar)
- TypeScript Vue Plugin (Volar)
- ESLint
- Prettier
- Auto Rename Tag
- Bracket Pair Colorizer

#### 浏览器开发工具
- Vue DevTools
- Chrome DevTools Performance面板
- WebGL Inspector（用于WebAV调试）

## 项目架构理解

### 模块化设计原则
项目采用模块化架构，每个模块负责特定功能：

```
stores/modules/
├── webavModule.ts      # WebAV引擎集成
├── mediaModule.ts      # 素材管理
├── playbackModule.ts   # 播放控制
├── configModule.ts     # 配置管理
├── trackModule.ts      # 轨道管理
├── timelineModule.ts   # 时间轴核心
├── viewportModule.ts   # 视口管理
├── selectionModule.ts  # 选择管理
└── clipOperationsModule.ts # 片段操作
```

### 数据流向
```
用户操作 → UI组件 → VideoStore → 模块状态 → WebAV引擎
                                              ↓
UI更新 ← 状态变化 ← 事件监听 ← WebAV事件 ← 渲染更新
```

### 组件层次结构
```
App.vue
└── VideoPreviewEngine.vue (主容器)
    ├── MediaLibrary.vue (素材库)
    ├── PreviewWindow.vue (预览窗口)
    │   └── WebAVRenderer.vue (WebAV渲染器)
    ├── PlaybackControls.vue (播放控制)
    ├── Timeline.vue (时间轴，包含轨道管理)
    │   ├── TimeScale.vue (时间刻度)
    │   └── VideoClip.vue (视频片段)
    ├── PropertiesPanel.vue (属性面板)
    └── ClipManagementToolbar.vue (片段管理工具栏)
```

## 开发工作流

### 添加新功能

#### 1. 分析需求
- 确定功能属于哪个模块
- 分析数据流和状态变化
- 确定需要的UI组件

#### 2. 创建或修改模块
```typescript
// 示例：添加新的配置选项
export function createConfigModule() {
  const newOption = ref(defaultValue)
  
  function setNewOption(value: any) {
    newOption.value = value
    console.log('新选项已设置:', value)
  }
  
  return {
    newOption,
    setNewOption
  }
}
```

#### 3. 更新VideoStore
```typescript
// 在videoStore.ts中集成新模块
const configModule = createConfigModule()

return {
  // 导出新状态和方法
  newOption: configModule.newOption,
  setNewOption: configModule.setNewOption
}
```

#### 4. 创建或更新UI组件
```vue
<template>
  <div class="new-feature">
    <!-- UI内容 -->
  </div>
</template>

<script setup lang="ts">
import { useVideoStore } from '../stores/videoStore'

const videoStore = useVideoStore()

// 使用新功能
const handleNewFeature = () => {
  videoStore.setNewOption(newValue)
}
</script>
```

### 调试技巧

#### WebAV调试
```typescript
// 使用内置调试工具
import { logWebAVReadyStateChange, debugError } from '../utils/webavDebug'

// 监控WebAV状态变化
watch(() => videoStore.isWebAVReady, (isReady, wasReady) => {
  logWebAVReadyStateChange(isReady, wasReady)
})

// 错误处理
try {
  await webAVOperation()
} catch (error) {
  debugError('WebAV操作失败', error, { context: 'additional info' })
}
```

#### 性能监控
```typescript
// 使用性能计时器
const timer = createPerformanceTimer('操作名称')
await performOperation()
const duration = timer.end()
console.log(`操作耗时: ${duration}ms`)
```

#### 状态调试
```typescript
// 在组件中添加调试信息
onMounted(() => {
  console.log('组件状态:', {
    mediaItems: videoStore.mediaItems.value.length,
    timelineItems: videoStore.timelineItems.value.length,
    isWebAVReady: videoStore.isWebAVReady.value
  })
})
```

### 测试策略

#### 单元测试
```typescript
// 测试模块功能
describe('ConfigModule', () => {
  it('应该正确设置配置选项', () => {
    const module = createConfigModule()
    module.setNewOption('test-value')
    expect(module.newOption.value).toBe('test-value')
  })
})
```

#### 集成测试
```typescript
// 测试组件集成
describe('VideoPreviewEngine', () => {
  it('应该正确初始化WebAV', async () => {
    const wrapper = mount(VideoPreviewEngine)
    await nextTick()
    expect(wrapper.vm.videoStore.isWebAVReady).toBe(true)
  })
})
```

#### 手动测试清单
- [ ] 视频文件导入功能
- [ ] 时间轴拖拽操作
- [ ] 播放控制功能
- [ ] 视频属性调整
- [ ] 分辨率切换
- [ ] 错误处理和恢复

## 代码规范

### TypeScript规范
```typescript
// ✅ 正确：明确的类型定义
interface MediaItem {
  id: string
  name: string
  duration: number
}

// ✅ 正确：使用泛型
function processItems<T>(items: T[]): T[] {
  return items.filter(item => item !== null)
}

// ❌ 错误：使用any类型
function processData(data: any): any {
  return data
}
```

### Vue组件规范
```vue
<script setup lang="ts">
// ✅ 正确：导入顺序
import { ref, computed, onMounted } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import ChildComponent from './ChildComponent.vue'

// ✅ 正确：响应式数据定义
const isLoading = ref(false)
const videoStore = useVideoStore()

// ✅ 正确：计算属性
const formattedTime = computed(() => {
  return formatTime(videoStore.currentTime.value)
})

// ✅ 正确：方法定义
const handleClick = () => {
  // 处理逻辑
}

// ✅ 正确：生命周期钩子
onMounted(() => {
  // 初始化逻辑
})
</script>

<template>
  <!-- ✅ 正确：清晰的模板结构 -->
  <div class="component-container">
    <header class="component-header">
      <h2>{{ title }}</h2>
    </header>
    <main class="component-content">
      <!-- 内容 -->
    </main>
  </div>
</template>

<style scoped>
/* ✅ 正确：使用CSS变量 */
.component-container {
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
}
</style>
```

### CSS规范
```css
/* ✅ 正确：BEM命名规范 */
.video-clip {
  /* 基础样式 */
}

.video-clip__header {
  /* 子元素样式 */
}

.video-clip--selected {
  /* 修饰符样式 */
}

/* ✅ 正确：使用CSS变量 */
:root {
  --color-primary: #007acc;
  --spacing-small: 8px;
  --border-radius: 4px;
}
```

## 性能优化

### WebAV性能优化
```typescript
// ✅ 正确：复用MP4Clip实例
const clonedClip = cloneMP4Clip(originalClip)

// ✅ 正确：及时清理资源
onUnmounted(() => {
  sprite?.destroy()
  mp4Clip?.destroy()
})

// ✅ 正确：避免频繁的WebAV操作
const debouncedSeek = debounce((time: number) => {
  webAVControls.seekTo(time)
}, 100)
```

### Vue性能优化
```vue
<script setup lang="ts">
// ✅ 正确：使用shallowRef避免深度响应式
const webAVObjects = shallowRef(new Map())

// ✅ 正确：使用markRaw避免响应式包装
const mp4Clip = markRaw(await createMP4Clip(file))

// ✅ 正确：使用computed缓存计算结果
const expensiveComputation = computed(() => {
  return heavyCalculation(props.data)
})
</script>

<template>
  <!-- ✅ 正确：使用v-memo优化列表渲染 -->
  <div
    v-for="item in items"
    :key="item.id"
    v-memo="[item.id, item.name, item.isSelected]"
  >
    {{ item.name }}
  </div>
</template>
```

## 常见问题解决

### WebAV相关问题

#### 问题：WebAV对象访问私有字段错误
```typescript
// ❌ 错误的做法
sprite.someMethod() // 可能报错：Cannot access private field

// ✅ 正确的做法
const rawSprite = toRaw(sprite)
rawSprite.someMethod()
```

#### 问题：内存泄漏
```typescript
// ✅ 正确：及时清理事件监听器
onUnmounted(() => {
  sprite.off('propsChange', handlePropsChange)
  avCanvas.off('timeupdate', handleTimeUpdate)
})
```

### Vue相关问题

#### 问题：响应式数据更新不及时
```typescript
// ✅ 正确：使用nextTick等待DOM更新
await nextTick()
// 现在可以安全地访问更新后的DOM
```

#### 问题：组件间通信复杂
```typescript
// ✅ 正确：使用Pinia进行状态管理
const videoStore = useVideoStore()
videoStore.updateState(newValue)
```

## 部署和发布

### 构建优化
```bash
# 生产构建
npm run build

# 类型检查
npm run type-check

# 代码检查
npm run lint

# 代码格式化
npm run format
```

### 部署检查清单
- [ ] 所有TypeScript错误已修复
- [ ] ESLint检查通过
- [ ] 构建成功无警告
- [ ] 功能测试通过
- [ ] 性能测试通过
- [ ] 浏览器兼容性测试
