# AI视频编辑器

一个基于Vue 3和WebAV技术栈的现代化视频编辑器，提供高性能的视频预览、时间轴编辑和实时渲染功能。

## 🚀 项目特色

- **高性能渲染**: 基于WebAV的硬件加速视频渲染引擎
- **现代化架构**: Vue 3 + TypeScript + Pinia状态管理
- **模块化设计**: 清晰的模块分离和组件化架构
- **实时预览**: 支持实时视频预览和时间轴编辑
- **响应式界面**: 自适应布局和可调整面板大小

## 🛠️ 技术栈

### 核心技术
- **Vue 3**: 前端框架，使用Composition API
- **TypeScript**: 类型安全的JavaScript超集
- **Pinia**: 现代化的Vue状态管理库
- **Vite**: 快速的构建工具和开发服务器

### 视频处理
- **@webav/av-canvas**: WebAV画布渲染引擎
- **@webav/av-cliper**: 视频剪辑和处理库
- **VideoVisibleSprite**: 自定义视频精灵组件

### 开发工具
- **ESLint**: 代码质量检查
- **Prettier**: 代码格式化
- **Vue DevTools**: Vue开发调试工具

## 📁 项目结构

```
frontend/
├── src/
│   ├── components/          # Vue组件
│   │   ├── VideoPreviewEngine.vue    # 主编辑器界面
│   │   ├── PreviewWindow.vue         # 视频预览窗口
│   │   ├── Timeline.vue              # 时间轴组件
│   │   ├── MediaLibrary.vue          # 素材库
│   │   ├── PlaybackControls.vue      # 播放控制
│   │   ├── PropertiesPanel.vue       # 属性面板
│   │   └── WebAVRenderer.vue         # WebAV渲染器
│   ├── stores/              # 状态管理
│   │   ├── videoStore.ts             # 主状态存储
│   │   ├── modules/                  # 模块化状态管理
│   │   │   ├── webavModule.ts        # WebAV集成模块
│   │   │   ├── mediaModule.ts        # 媒体管理模块
│   │   │   ├── playbackModule.ts     # 播放控制模块
│   │   │   ├── configModule.ts       # 配置管理模块
│   │   │   ├── trackModule.ts        # 轨道管理模块
│   │   │   ├── timelineModule.ts     # 时间轴核心模块
│   │   │   ├── viewportModule.ts     # 视口管理模块
│   │   │   ├── selectionModule.ts    # 选择管理模块
│   │   │   ├── historyModule.ts      # 操作历史模块
│   │   │   └── clipOperationsModule.ts # 片段操作模块
│   │   └── utils/                    # 工具函数模块
│   │       ├── storeUtils.ts         # 工具函数索引（向后兼容）
│   │       ├── debugUtils.ts         # 调试工具
│   │       ├── timeUtils.ts          # 时间计算工具
│   │       ├── coordinateUtils.ts    # 坐标转换工具
│   │       ├── timelineSearchUtils.ts # 查找工具
│   │       ├── timelineArrangementUtils.ts # 自动整理工具
│   │       ├── zoomUtils.ts          # 缩放计算工具
│   │       ├── durationUtils.ts      # 时长计算工具
│   │       ├── timeRangeUtils.ts     # 时间范围工具
│   │       └── dataValidationUtils.ts # 数据验证工具
│   ├── composables/         # 组合式函数
│   │   ├── useWebAVControls.ts       # WebAV控制器
│   │   └── useDragPreview.ts         # 拖拽预览管理
│   ├── utils/               # 工具类
│   │   ├── VideoVisibleSprite.ts     # 自定义视频精灵
│   │   ├── coordinateTransform.ts    # 坐标转换
│   │   ├── rotationTransform.ts      # 旋转变换
│   │   └── webavDebug.ts             # WebAV调试工具
│   ├── types/               # TypeScript类型定义
│   │   └── videoTypes.ts             # 视频相关类型
│   └── styles/              # 样式文件
│       └── common.css                # 通用样式
├── docs/                    # 项目文档
│   ├── user/                # 用户文档
│   ├── developer/           # 开发者文档
│   └── features/            # 功能实现文档
├── public/                  # 静态资源
├── package.json            # 项目依赖配置
├── vite.config.ts          # Vite配置
├── tsconfig.json           # TypeScript配置
└── eslint.config.ts        # ESLint配置
```

## 🏗️ 架构设计

### 模块化状态管理
项目采用模块化的状态管理架构，将不同功能拆分为独立模块：

#### 状态管理模块
- **WebAV模块**: 管理WebAV引擎的初始化和核心功能
- **媒体模块**: 处理素材库和媒体文件管理
- **播放模块**: 控制视频播放状态和时间
- **配置模块**: 管理项目设置和视频分辨率
- **轨道模块**: 处理时间轴轨道管理
- **时间轴模块**: 核心时间轴逻辑和项目管理
- **视口模块**: 管理时间轴缩放和滚动
- **选择模块**: 处理元素选择和同步
- **片段操作模块**: 视频片段的增删改查操作

#### 工具函数模块 ✨ 新架构
项目采用模块化的工具函数设计，按功能领域拆分为独立模块：

- **调试工具** (`debugUtils.ts`): 调试信息打印和开关管理
- **时间计算** (`timeUtils.ts`): 时间格式化、对齐和计算
- **坐标转换** (`coordinateUtils.ts`): 时间与像素位置互转
- **查找工具** (`timelineSearchUtils.ts`): 时间轴项目查找和过滤
- **自动整理** (`timelineArrangementUtils.ts`): 时间轴自动排序和整理
- **缩放计算** (`zoomUtils.ts`): 缩放级别和滚动偏移计算
- **时长计算** (`durationUtils.ts`): 各种时长相关计算
- **时间范围** (`timeRangeUtils.ts`): 时间范围验证和同步
- **数据验证** (`dataValidationUtils.ts`): 数据完整性验证和清理

### WebAV集成架构
- **单例模式**: 全局唯一的AVCanvas实例
- **组合式API**: 通过useWebAVControls提供统一的WebAV控制接口
- **异步初始化**: 支持WebAV引擎的异步加载和初始化
- **错误处理**: 完善的错误捕获和状态管理

### 数据流设计
```
UI组件 → VideoStore → 模块化状态 → WebAV引擎
   ↑                                    ↓
   ← 事件监听 ← propsChange事件 ← VideoVisibleSprite
```

## 🚦 快速开始

### 环境要求
- Node.js >= 18.0.0
- npm >= 8.0.0

### 安装依赖
```bash
cd frontend
npm install
```

### 开发模式
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
```

### 代码检查
```bash
npm run lint
```

### 代码格式化
```bash
npm run format
```

## 🎯 核心功能

### 视频编辑功能
- ✅ 视频文件导入和预览
- ✅ 时间轴拖拽编辑
- ✅ 多选和批量操作
- ✅ 撤销/重做操作历史
- ✅ 实时播放控制
- ✅ 视频属性调整（位置、缩放、旋转、透明度）
- ✅ 多轨道支持
- ✅ 视频分辨率设置

### 高级功能
- ✅ 统一的拖拽预览系统
- ✅ 智能的选择同步机制
- ✅ 批量操作命令系统
- ✅ 完整的操作历史管理
- ✅ 冲突检测和视觉反馈

### 界面功能
- ✅ 可调整的面板布局
- ✅ 响应式设计
- ✅ 深色主题界面
- ✅ 直观的拖拽操作
- ✅ 实时状态反馈

### 性能优化
- ✅ WebAV硬件加速渲染
- ✅ 异步视频解析
- ✅ 智能内存管理
- ✅ 帧对齐和时间精确控制

### 代码质量 ✨ 最新改进
- ✅ 模块化工具函数架构
- ✅ 单一职责原则设计
- ✅ 按需导入和tree-shaking优化
- ✅ 完善的TypeScript类型支持
- ✅ 向后兼容的渐进式重构

## 🔧 开发指南

### 添加新组件
1. 在`src/components/`目录下创建Vue组件
2. 使用TypeScript和Composition API
3. 遵循项目的命名约定和代码风格

### 扩展状态管理
1. 在`src/stores/modules/`下创建新模块
2. 在`videoStore.ts`中集成新模块
3. 确保模块间的依赖关系清晰

### WebAV集成
1. 使用`useWebAVControls`组合式函数
2. 通过`VideoVisibleSprite`处理视频对象
3. 注意WebAV对象需要使用`markRaw`避免Vue响应式包装

## 📝 开发注意事项

### WebAV对象处理
- WebAV对象不能被Vue响应式系统包装，需要使用`markRaw()`
- VideoVisibleSprite需要通过`toRaw()`获取原始对象进行操作
- 监听WebAV事件时要注意内存泄漏问题

### 坐标系统
- 画布坐标系以中心点(0,0)为原点
- 缩放因子1.0表示等比例显示
- 位置和尺寸需要根据画布分辨率进行转换

### 性能考虑
- 视频解析采用异步处理，避免阻塞UI
- 大文件处理时显示加载状态
- 及时清理不再使用的WebAV资源

## 🤝 贡献指南

1. Fork项目仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

## 📄 许可证

本项目采用MIT许可证 - 查看[LICENSE](LICENSE)文件了解详情

## 🔍 详细功能说明

### 视频导入和管理
- **支持格式**: MP4, WebM, MOV等主流视频格式
- **异步解析**: 视频文件上传后异步创建MP4Clip，显示解析进度
- **素材库**: 统一管理所有导入的视频素材
- **预览缩略图**: 自动生成视频缩略图用于素材库显示

### 时间轴编辑
- **多轨道支持**: 支持多个视频轨道的并行编辑
- **精确定位**: 基于帧率的精确时间定位和对齐
- **拖拽操作**: 支持素材从素材库拖拽到时间轴
- **片段分割**: 支持在任意时间点分割视频片段
- **片段合并**: 支持相邻片段的合并操作

### 视频预览
- **实时渲染**: 基于WebAV的硬件加速实时渲染
- **播放控制**: 播放、暂停、快进、快退等完整控制
- **时间同步**: 预览窗口与时间轴的精确时间同步
- **分辨率设置**: 支持多种视频分辨率的设置和切换

### 视频属性编辑
- **位置调整**: 支持视频在画布中的位置调整
- **缩放控制**: 支持等比例和非等比例缩放
- **旋转变换**: 支持任意角度的旋转操作
- **透明度**: 支持透明度调整和混合效果
- **层级管理**: 支持多层视频的层级调整

## 🏛️ 技术架构详解

### 状态管理架构
项目采用Pinia进行状态管理，通过模块化设计实现功能分离：

```typescript
// 主状态存储结构
videoStore = {
  // 核心数据
  mediaItems,      // 素材库数据
  timelineItems,   // 时间轴项目数据
  tracks,          // 轨道数据

  // 播放状态
  currentTime,     // 当前播放时间
  isPlaying,       // 播放状态
  playbackRate,    // 播放速率

  // 选择状态
  selectedTimelineItemId,   // 选中的时间轴项
  selectedTimelineItemIds,  // 多选时间轴项集合

  // 视口状态
  zoomLevel,       // 缩放级别
  scrollOffset,    // 滚动偏移
  visibleDuration, // 可见时长
}
```

### WebAV集成方案
- **单例模式**: 全局唯一的AVCanvas实例，避免资源冲突
- **异步初始化**: 支持WebAV引擎的渐进式加载
- **内存管理**: 自动清理不再使用的WebAV资源
- **错误恢复**: 完善的错误处理和状态恢复机制

### 组件通信机制
- **Props/Events**: 父子组件间的标准通信
- **Pinia Store**: 跨组件的状态共享
- **WebAV Events**: WebAV对象的事件监听和响应
- **Custom Events**: 自定义事件系统用于复杂交互

## 🧪 测试和调试

### 调试工具
项目内置了完善的调试工具：

```typescript
// WebAV调试工具
import {
  logWebAVReadyStateChange,
  logComponentLifecycle,
  createPerformanceTimer,
  debugError
} from '../utils/webavDebug'
```

### 性能监控
- **渲染性能**: 监控WebAV渲染性能和帧率
- **内存使用**: 跟踪内存使用情况和潜在泄漏
- **加载时间**: 监控视频文件加载和解析时间
- **操作响应**: 监控用户操作的响应时间

## 🔧 配置和自定义

### 项目配置
```typescript
// 默认配置
const defaultConfig = {
  videoResolution: { width: 1920, height: 1080 },
  frameRate: 30,
  timelineDuration: 60,
  proportionalScale: true
}
```

### 自定义主题
项目支持CSS变量自定义主题：

```css
:root {
  --color-bg-primary: #1a1a1a;
  --color-bg-secondary: #2d2d2d;
  --color-text-primary: #ffffff;
  --color-accent: #007acc;
}
```

## 🚀 部署指南

### 构建优化
- **代码分割**: 自动进行代码分割和懒加载
- **资源压缩**: 自动压缩CSS、JS和图片资源
- **缓存策略**: 合理的缓存策略提升加载速度

### 部署环境
- **开发环境**: 使用Vite开发服务器
- **生产环境**: 构建静态文件部署到CDN或静态服务器
- **容器化**: 支持Docker容器化部署

## 📚 文档

### 📖 文档导航
详细的项目文档请查看 [docs/](docs/) 目录，已按功能重新整理：

#### 🚀 01-快速开始
- **[项目概述](docs/01-快速开始/项目概述.md)** - 项目介绍、特色功能和技术栈
- **[安装指南](docs/01-快速开始/安装指南.md)** - 环境要求、依赖安装和配置
- **[快速上手](docs/01-快速开始/快速上手.md)** - 基础操作和入门教程

#### 👤 02-用户指南
- **[界面介绍](docs/02-用户指南/界面介绍.md)** - 主界面布局和功能区域说明
- **[基础操作](docs/02-用户指南/基础操作.md)** - 视频导入、编辑和导出流程
- **[高级功能](docs/02-用户指南/高级功能.md)** - 高级编辑技巧和功能详解
- **[故障排除](docs/02-用户指南/故障排除.md)** - 常见问题和解决方案

#### 👨‍💻 03-开发文档
- **[架构设计](docs/03-开发文档/架构设计.md)** - 系统架构、模块设计和技术选型
- **[开发环境](docs/03-开发文档/开发环境.md)** - 开发环境设置和工作流程
- **[API文档](docs/03-开发文档/API文档.md)** - 详细的API接口文档和使用示例
- **[代码规范](docs/03-开发文档/代码规范.md)** - 编码标准和最佳实践

#### 🔧 04-功能实现
- **[操作历史系统](docs/04-功能实现/操作历史系统.md)** - 撤销/重做功能的完整实现
- **[拖拽系统](docs/04-功能实现/拖拽系统.md)** - 统一的拖拽操作系统
- **[选择系统](docs/04-功能实现/选择系统.md)** - 单选/多选的统一管理
- **[批量操作](docs/04-功能实现/批量操作.md)** - 批量操作的命令模式实现
- **[关键帧动画](docs/04-功能实现/关键帧动画.md)** - 关键帧动画系统设计

#### 🏗️ 05-重构记录
- **[重构总览](docs/05-重构记录/重构总览.md)** - 项目重构历程和成果总结
- **[模块化重构](docs/05-重构记录/模块化重构.md)** - 工具函数模块化重构详解
- **[播放控制重构](docs/05-重构记录/播放控制重构.md)** - 播放控制逻辑统一化
- **[时间控制重构](docs/05-重构记录/时间控制重构.md)** - 时间控制系统重构
- **[WebAV清理](docs/05-重构记录/WebAV清理.md)** - WebAV相关代码清理和优化

#### 📋 06-项目规划
- **[未来计划](docs/06-项目规划/未来计划.md)** - 项目发展路线图和功能规划
- **[版本历史](docs/06-项目规划/版本历史.md)** - 版本更新记录和变更日志
- **[技术债务](docs/06-项目规划/技术债务.md)** - 已知问题和改进计划

### 🔗 快速链接
- [项目特色功能](docs/01-快速开始/项目概述.md#项目特色)
- [安装和配置](docs/01-快速开始/安装指南.md)
- [基础操作教程](docs/01-快速开始/快速上手.md)
- [架构设计详解](docs/03-开发文档/架构设计.md)
- [重构成果总结](docs/05-重构记录/重构总览.md)

## 🙏 致谢

- [WebAV](https://github.com/hughfenghen/WebAV) - 强大的Web视频处理库
- [Vue.js](https://vuejs.org/) - 渐进式JavaScript框架
- [Vite](https://vitejs.dev/) - 下一代前端构建工具
- [Pinia](https://pinia.vuejs.org/) - Vue的现代状态管理库
