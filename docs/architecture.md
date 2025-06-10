# AI视频编辑器 - 代码架构文档

## 技术栈

### 前端框架
- **Vue 3**: 使用Composition API的现代Vue框架
- **TypeScript**: 类型安全的JavaScript超集
- **Vite**: 快速的构建工具和开发服务器
- **Pinia**: Vue 3的状态管理库

### 视频处理
- **WebAV SDK**: 核心视频渲染引擎
  - `@webav/av-canvas`: 画布渲染组件
  - `@webav/av-cliper`: 视频剪辑功能
- **WebCodecs API**: 浏览器原生视频编解码

### 开发工具
- **ESLint**: 代码质量检查
- **Prettier**: 代码格式化
- **Vue TSC**: TypeScript类型检查

## 项目结构

```
frontend/
├── src/
│   ├── components/          # Vue组件
│   │   ├── VideoPreviewEngine.vue    # 主应用容器
│   │   ├── MediaLibrary.vue          # 素材库
│   │   ├── PreviewWindow.vue         # 预览窗口
│   │   ├── MultiTrackVideoRenderer.vue # 多轨道渲染器
│   │   ├── Timeline.vue              # 时间轴
│   │   ├── VideoClip.vue             # 视频片段
│   │   ├── PlaybackControls.vue      # 播放控制
│   │   ├── PropertiesPanel.vue       # 属性面板
│   │   ├── ClipManagementToolbar.vue # 片段管理工具栏
│   │   ├── TimeScale.vue             # 时间刻度
│   │   └── TrackManager.vue          # 轨道管理
│   ├── stores/              # 状态管理
│   │   └── counter.ts       # 主要状态store
│   ├── utils/               # 工具函数
│   │   ├── videoHelper.ts   # 视频处理工具
│   │   └── webavRenderer.ts # WebAV渲染器封装
│   ├── App.vue              # 根组件
│   └── main.ts              # 应用入口
├── public/                  # 静态资源
├── package.json             # 依赖配置
├── vite.config.ts           # Vite配置
└── tsconfig.json            # TypeScript配置
```

## 核心架构

### 1. 组件层次结构

```
App.vue
└── VideoPreviewEngine.vue (主容器)
    ├── MediaLibrary.vue (素材库)
    ├── PreviewWindow.vue (预览区)
    │   └── MultiTrackVideoRenderer.vue (渲染器)
    ├── PropertiesPanel.vue (属性面板)
    ├── PlaybackControls.vue (播放控制)
    ├── ClipManagementToolbar.vue (工具栏)
    └── Timeline.vue (时间轴)
        ├── TimeScale.vue (时间刻度)
        ├── TrackManager.vue (轨道管理)
        └── VideoClip.vue (视频片段) × N
```

### 2. 状态管理架构

#### 主要状态 (stores/counter.ts)
```typescript
interface VideoStore {
  // 核心数据
  clips: VideoClip[]           // 视频片段列表
  tracks: Track[]              // 轨道列表
  currentTime: number          // 当前播放时间
  isPlaying: boolean           // 播放状态
  selectedClipId: string       // 选中的片段ID
  
  // 时间轴控制
  timelineDuration: number     // 时间轴总长度
  zoomLevel: number            // 缩放级别
  scrollOffset: number         // 滚动偏移
  
  // 播放控制
  playbackRate: number         // 播放速度
  volume: number               // 音量
  isMuted: boolean             // 静音状态
  
  // 视频设置
  videoResolution: VideoResolution // 视频分辨率
  proportionalScale: boolean   // 等比缩放
}
```

#### 核心数据类型
```typescript
interface VideoClip {
  id: string
  file: File
  url: string
  duration: number
  originalDuration: number
  startTime: number
  endTime: number
  timelinePosition: number
  name: string
  playbackRate: number
  trackId: number
  transform: VideoTransform
  zIndex: number
  originalResolution?: { width: number; height: number }
}

interface VideoTransform {
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotation: number
  opacity: number
}

interface Track {
  id: number
  name: string
  isVisible: boolean
  isMuted: boolean
  height: number
}
```

### 3. 渲染引擎架构

#### WebAV渲染器 (utils/webavRenderer.ts)
```typescript
class WebAVRenderer {
  private avCanvas: AVCanvas           // WebAV画布实例
  private currentSprite: VisibleSprite // 当前精灵对象
  private currentClip: MP4Clip         // 当前视频剪辑
  
  // 核心方法
  init(container: HTMLElement)         // 初始化渲染器
  loadVideo(clip: VideoClip)           // 加载视频
  updateTime(time: number)             // 更新播放时间
  applyTransform(sprite, clip)         // 应用变换
  clear()                              // 清空画布
  destroy()                            // 销毁资源
}
```

#### 渲染流程
1. **初始化**: 创建AVCanvas实例
2. **加载视频**: 创建MP4Clip和VisibleSprite
3. **时间同步**: 根据currentTime更新视频帧
4. **变换应用**: 实时应用位置、缩放、旋转等变换
5. **事件处理**: 处理用户交互和属性变化

## 关键组件详解

### 1. VideoPreviewEngine.vue
**作用**: 主应用容器，管理整体布局和面板调整
**核心功能**:
- 三列布局管理（素材库、预览、属性）
- 可拖拽分割器实现面板大小调整
- 播放控制集成
- 分辨率设置模态框

### 2. MultiTrackVideoRenderer.vue
**作用**: 核心视频渲染组件，基于WebAV SDK
**核心功能**:
- WebAV引擎初始化和管理
- 视频加载和播放同步
- 变换属性实时应用
- 浏览器兼容性检查
- 性能监控和调试

### 3. Timeline.vue
**作用**: 时间轴主组件，管理多轨道编辑
**核心功能**:
- 多轨道显示和管理
- 拖拽添加视频片段
- 时间轴缩放和滚动
- 网格线和时间刻度
- 片段交互处理

### 4. VideoClip.vue
**作用**: 单个视频片段组件
**核心功能**:
- 片段可视化显示（缩略图、名称、时长）
- 拖拽移动和调整大小
- 选中状态管理
- 右键菜单操作
- 重叠检测和视觉反馈

### 5. PropertiesPanel.vue
**作用**: 属性编辑面板
**核心功能**:
- 基本信息显示和编辑
- 变换属性实时调整
- 播放设置控制
- 双向数据绑定
- 输入验证和格式化

## 数据流架构

### 1. 单向数据流
```
User Action → Component Event → Store Mutation → State Update → UI Re-render
```

### 2. 关键数据流

#### 视频加载流程
```
MediaLibrary → File Selection → Store.addClip() → Timeline Update → Renderer.loadVideo()
```

#### 播放控制流程
```
PlaybackControls → Store.play() → Time Update Loop → Renderer.updateTime() → Frame Render
```

#### 属性编辑流程
```
PropertiesPanel → Input Change → Store.updateClipTransform() → Renderer.applyTransform()
```

#### 时间轴交互流程
```
Timeline Click → Store.setCurrentTime() → Renderer.updateTime() → Preview Update
```

## 性能优化策略

### 1. 渲染优化
- **WebAV硬件加速**: 利用WebCodecs API的硬件解码
- **帧级缓存**: 智能缓存常用帧数据
- **按需渲染**: 只在时间变化时重新渲染
- **资源管理**: 及时释放不用的视频资源

### 2. 内存管理
- **对象池**: 复用VideoFrame对象
- **垃圾回收**: 主动释放大对象引用
- **流式加载**: 大文件分块加载
- **URL管理**: 及时revoke ObjectURL

### 3. 交互优化
- **防抖处理**: 高频事件的防抖优化
- **虚拟滚动**: 大量片段时的虚拟化
- **异步操作**: 非阻塞的文件处理
- **错误边界**: 优雅的错误处理

## 扩展性设计

### 1. 插件架构
- **渲染器接口**: 可替换的渲染引擎
- **效果系统**: 可扩展的视频效果
- **导出器**: 多格式导出支持

### 2. 模块化设计
- **组件解耦**: 松耦合的组件设计
- **状态分离**: 清晰的状态管理边界
- **工具函数**: 可复用的工具库

### 3. 配置化
- **主题系统**: 可配置的UI主题
- **快捷键**: 可自定义的键盘快捷键
- **预设管理**: 可保存的编辑预设

## 开发规范

### 1. 代码规范
- **TypeScript**: 严格的类型检查
- **ESLint**: 统一的代码风格
- **组件命名**: PascalCase组件名
- **文件组织**: 功能模块化组织

### 2. 性能规范
- **响应式优化**: 合理使用computed和watch
- **事件处理**: 及时清理事件监听器
- **内存泄漏**: 避免循环引用和内存泄漏
- **异步处理**: 合理使用Promise和async/await

### 3. 测试策略
- **单元测试**: 核心逻辑的单元测试
- **集成测试**: 组件间交互测试
- **性能测试**: 渲染性能基准测试
- **兼容性测试**: 多浏览器兼容性验证
