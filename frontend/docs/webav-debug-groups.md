# WebAV 调试信息分组说明

## 📋 调试信息分组概览

WebAV调试信息已经按照功能和流程进行了分组，使用不同的前缀和emoji来区分不同类型的调试信息。

## 🚀 初始化相关 (INIT)

### 主要前缀
- `🚀 [WebAV Init]` - 主要初始化流程
- `📦 [Container]` - 容器创建相关
- `🎨 [Canvas]` - 画布创建相关
- `🎧 [Events]` - 事件监听器设置

### 涵盖的流程
1. **WebAV Canvas初始化** - 完整的9步初始化流程
2. **容器创建** - 程序化创建画布容器
3. **事件监听器设置** - 播放、暂停、时间更新等事件
4. **性能监控** - 初始化各阶段的耗时统计

### 示例日志
```
🚀 [WebAV Init] Starting WebAV Canvas initialization
📦 [Container] Creating canvas container...
🎨 [Canvas] AVCanvas instance created successfully
🎉 🚀 [WebAV Init] Initialization completed successfully!
```

## 🔄 画布重建相关 (REBUILD)

### 主要前缀
- `🔄 [Canvas Rebuild]` - 主要重建流程
- `💥 [Destroy]` - 画布销毁过程
- `📦 [Backup]` - 内容备份过程
- `🔄 [Restore]` - 内容恢复过程
- `📐 [Coordinates]` - 坐标转换过程

### 涵盖的流程
1. **画布销毁** - 备份当前状态并销毁画布
2. **内容备份** - 备份所有sprites和播放状态
3. **画布重建** - 使用新参数重新创建画布
4. **内容恢复** - 恢复sprites、坐标转换、属性设置
5. **状态同步** - 重新建立双向数据同步

### 示例日志
```
🔄 [Canvas Rebuild] Starting canvas destruction
📦 [Backup] Backing up 3 sprites
💥 [Destroy] Destruction completed
🔄 [Canvas Rebuild] Starting canvas recreation
🔄 [Restore] Restoring sprite 1/3: video-clip-1
📐 [Coordinates] Coordinate transform: video-clip-1
🎉 🔄 [Canvas Rebuild] Recreation completed successfully!
```

## 🎬 组件生命周期相关 (LIFECYCLE)

### 主要前缀
- `🎬 [Lifecycle]` - 主要生命周期流程
- `🖼️ [Renderer]` - 渲染器组件相关
- `⚙️ [Engine]` - 主引擎组件相关
- `🏪 [Store]` - 状态管理相关

### 涵盖的流程
1. **组件挂载/卸载** - Vue组件的生命周期
2. **WebAV就绪状态** - WebAV准备就绪的状态变化
3. **Store状态变化** - AVCanvas、就绪状态、错误状态的变化
4. **渲染器状态** - 渲染器组件的状态和配置

### 示例日志
```
🔄 🎬 [Lifecycle] [WebAV Renderer] mounted
🖼️ [Renderer] State: { hasWrapper: true, canvasDisplaySize: {...} }
🏪 [Store] setWebAVReady: { ready: true, previousReady: false }
⚙️ [Engine] WebAV ready state changed: { isReady: true, ... }
```

## ⚡ 性能监控相关 (PERFORMANCE)

### 主要前缀
- `⚡ [Performance]` - 主要性能监控
- `⏱️ [Timer]` - 计时器相关
- `📊 [Stats]` - 统计信息

### 涵盖的功能
1. **性能计时** - 关键操作的耗时统计
2. **统计信息** - 操作成功率、数据量等统计
3. **性能分析** - 性能瓶颈识别

### 示例日志
```
⏱️ [Timer] Starting: WebAV Canvas Initialization
⏱️ [Timer] Completed: WebAV Canvas Initialization - 45.23ms
📊 [Stats] Canvas Rebuild: { restoredSprites: 3, totalTime: "123.45ms" }
```

## 🔧 通用调试工具

### 错误处理
- `debugError()` - 统一的错误日志格式
- `debugLog()` - 条件调试日志（仅开发环境）

### 分组管理
- `createDebugGroup()` - 创建可折叠的日志分组
- `console.group()` / `console.groupEnd()` - 自动分组管理

## 📱 使用建议

### 1. 开发调试
- 所有调试信息在开发环境自动启用
- 使用浏览器控制台的分组功能查看结构化日志
- 关注性能计时信息识别瓶颈

### 2. 问题排查
- **初始化问题** - 查看 `🚀 [WebAV Init]` 相关日志
- **画布重建问题** - 查看 `🔄 [Canvas Rebuild]` 相关日志
- **组件生命周期问题** - 查看 `🎬 [Lifecycle]` 相关日志
- **性能问题** - 查看 `⚡ [Performance]` 相关日志

### 3. 日志过滤
在浏览器控制台中可以使用过滤器：
- 过滤初始化: `WebAV Init`
- 过滤重建: `Canvas Rebuild`
- 过滤生命周期: `Lifecycle`
- 过滤性能: `Performance`

## 🎯 调试信息的价值

1. **快速定位问题** - 通过分组快速找到相关日志
2. **了解执行流程** - 清楚了解WebAV的初始化和重建流程
3. **性能监控** - 实时监控关键操作的性能
4. **状态跟踪** - 跟踪组件和数据的状态变化
5. **错误诊断** - 详细的错误信息和上下文

这个分组结构使得调试信息更加有序和易于理解，帮助开发者快速定位和解决问题。
