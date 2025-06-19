# WebAV初始化逻辑清理

## 清理概述

本次清理移除了`webavModule.ts`中重复的WebAV初始化逻辑，实现了清晰的职责分离。

## 清理前的问题

### 重复的初始化逻辑
- **webavModule.ts**: 包含`initializeWebAV`、`destroyWebAV`、`rebuildWebAV`方法
- **useWebAVControls.ts**: 包含`initializeCanvas`、`destroyCanvas`、`recreateCanvas`方法
- 两套逻辑功能重叠，造成维护困难

### 职责不清
- webavModule既负责状态管理，又负责实际操作
- useWebAVControls作为后来引入的composable，功能更完整
- 实际使用中，组件都在调用useWebAVControls的方法

## 清理后的架构

### webavModule.ts - 纯状态管理
```typescript
interface WebAVModule {
  // 状态
  avCanvas: Ref<AVCanvas | null>
  isWebAVReady: Ref<boolean>
  webAVError: Ref<string | null>
  
  // 状态管理方法
  setAVCanvas(canvas: AVCanvas | null): void
  setWebAVReady(ready: boolean): void
  setWebAVError(error: string | null): void
  clearWebAVState(): void
  
  // 工具方法
  isWebAVAvailable(): boolean
  getWebAVSummary(): object
  addSprite(sprite: unknown): boolean
  removeSprite(sprite: unknown): boolean
}
```

### useWebAVControls.ts - WebAV操作层
```typescript
interface WebAVControls {
  // 容器管理
  createCanvasContainer(options: ContainerOptions): HTMLElement
  getCanvasContainer(): HTMLElement | null
  
  // 画布生命周期
  initializeCanvas(container: HTMLElement, options: CanvasOptions): Promise<void>
  destroyCanvas(): Promise<CanvasBackup | null>
  recreateCanvas(container: HTMLElement, options: CanvasOptions, backup?: CanvasBackup): Promise<void>
  
  // 媒体处理
  createMP4Clip(file: File): Promise<MP4Clip>
  createImgClip(file: File): Promise<ImgClip>
  cloneMP4Clip(clip: MP4Clip): Promise<MP4Clip>
  cloneImgClip(clip: ImgClip): Promise<ImgClip>
  
  // 播放控制
  play(startTime?: number, endTime?: number): void
  pause(): void
  seekTo(time: number): void
  
  // 实例访问
  getAVCanvas(): AVCanvas | null
}
```

## 移除的方法

### webavModule.ts中移除的方法
- `initializeWebAV(canvasElement: HTMLCanvasElement, options: any): Promise<boolean>`
- `destroyWebAV(): void`
- `rebuildWebAV(canvasElement: HTMLCanvasElement, options: any): Promise<boolean>`

### 新增的方法
- `clearWebAVState(): void` - 用于清理状态，由useWebAVControls调用

## 数据流向

```
组件层 (WebAVRenderer.vue)
    ↓
useWebAVControls (操作层)
    ↓
webavModule (状态管理层)
    ↓
videoStore (全局状态)
```

## 受影响的文件

### 修改的文件
- `frontend/src/stores/modules/webavModule.ts` - 移除初始化方法，保留状态管理
- `frontend/src/stores/videoStore.ts` - 更新导出的方法列表
- `docs/developer/ARCHITECTURE.md` - 更新架构文档
- `docs/developer/API.md` - 更新API文档

### 未受影响的文件
- `frontend/src/composables/useWebAVControls.ts` - 保持不变，继续作为主要操作层
- `frontend/src/components/WebAVRenderer.vue` - 继续使用useWebAVControls
- `frontend/src/components/PlaybackControls.vue` - 继续使用useWebAVControls

## 优势

### 1. 职责清晰
- **webavModule**: 专注于状态管理
- **useWebAVControls**: 专注于WebAV操作

### 2. 维护简单
- 只有一套初始化逻辑
- 减少代码重复
- 降低维护成本

### 3. 架构清晰
- 明确的数据流向
- 清晰的层次结构
- 更好的可测试性

## 向后兼容性

此次清理是内部重构，不影响外部API：
- 组件层调用方式不变
- 状态访问方式不变
- 功能行为保持一致

---

*清理完成时间：2025-06-19*
