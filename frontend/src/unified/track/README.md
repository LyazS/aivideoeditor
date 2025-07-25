# 统一轨道模块 (Unified Track Module)

基于重构文档的统一类型设计理念，提供完整的轨道管理功能。

## 📁 模块结构

```
frontend/src/unified/track/
├── types.ts      # 纯类型定义
├── utils.ts      # 工具函数和业务逻辑
├── index.ts      # 导出职责
└── README.md     # 文档说明
```

## 🎯 设计理念

- **状态驱动的统一架构**：与 UnifiedTimelineItem 完美集成
- **响应式数据结构**：核心数据 + 行为函数 + 查询函数
- **类型安全**：完整的 TypeScript 类型定义
- **职责分离**：类型、工具函数、导出职责清晰分离

## 📋 文件职责

### `types.ts` - 纯类型定义
负责定义所有轨道相关的类型和常量：

```typescript
// 核心类型
export type UnifiedTrackType = 'video' | 'audio' | 'text'
export type UnifiedTrackStatus = 'active' | 'disabled' | 'locked'

// 接口定义
export interface UnifiedTrack { ... }
export interface UnifiedTrackConfig { ... }
export interface UnifiedTrackSummary { ... }

// 常量定义
export const DEFAULT_UNIFIED_TRACK_CONFIGS = { ... }
export const UNIFIED_TRACK_TYPE_NAMES = { ... }
```

### `utils.ts` - 工具函数和业务逻辑
包含所有轨道相关的工具函数：

```typescript
// 类型守卫
export function isValidUnifiedTrackType(type: string): type is UnifiedTrackType
export function isUnifiedTrack(obj: any): obj is UnifiedTrack

// 能力检查
export function supportsVisibility(track: UnifiedTrack): boolean
export function supportsMute(track: UnifiedTrack): boolean

// UI辅助函数
export function getUnifiedTrackTypeIcon(type: UnifiedTrackType): string
export function getUnifiedTrackStatusLabel(status: UnifiedTrackStatus): string

// 验证函数
export function validateUnifiedTrackConfig(config: UnifiedTrackConfig): UnifiedTrackValidationResult

// 工具函数
export function cloneUnifiedTrack(track: UnifiedTrack, generateNewId: () => string): UnifiedTrack
export function generateUnifiedTrackName(type: UnifiedTrackType, existingTracks: UnifiedTrack[]): string
export function filterUnifiedTracks(tracks: UnifiedTrack[], filters: {...}): UnifiedTrack[]
```

### `index.ts` - 导出职责
统一导出所有类型和函数：

```typescript
// 类型导出
export type { UnifiedTrack, UnifiedTrackType, UnifiedTrackConfig, ... } from './types'

// 常量导出
export { DEFAULT_UNIFIED_TRACK_CONFIGS, UNIFIED_TRACK_TYPE_NAMES, ... } from './types'

// 函数导出
export { isValidUnifiedTrackType, supportsVisibility, validateUnifiedTrackConfig, ... } from './utils'
```

## 🚀 使用示例

### 基础使用

```typescript
import {
  type UnifiedTrack,
  type UnifiedTrackConfig,
  validateUnifiedTrackConfig,
  supportsVisibility,
  getUnifiedTrackTypeIcon,
} from '../../unified/track'

// 创建轨道配置
const config: UnifiedTrackConfig = {
  type: 'video',
  name: '主视频轨道',
  height: 80,
  color: '#FF5722',
}

// 验证配置
const validation = validateUnifiedTrackConfig(config)
if (!validation.isValid) {
  console.error('配置无效:', validation.errors)
}

// 检查轨道能力
const track: UnifiedTrack = { ... }
if (supportsVisibility(track)) {
  // 可以控制可见性
}

// 获取UI资源
const icon = getUnifiedTrackTypeIcon('video')
```

### 与轨道模块集成

```typescript
import { createUnifiedTrackModule } from '../../stores/modules/UnifiedTrackModule'
import { generateUnifiedTrackName, createDefaultUnifiedTrackConfig } from '../../unified/track'

const trackModule = createUnifiedTrackModule()

// 使用统一工具函数
const defaultConfig = createDefaultUnifiedTrackConfig('video', undefined, trackModule.tracks.value)
const newTrack = trackModule.addTrack(defaultConfig)
```

## 🔧 扩展指南

### 添加新的轨道类型

1. **更新类型定义** (`types.ts`)：
```typescript
export type UnifiedTrackType = 'video' | 'audio' | 'text' | 'subtitle' // 添加新类型
```

2. **更新常量** (`types.ts`)：
```typescript
export const UNIFIED_TRACK_TYPE_NAMES = {
  // ...existing
  subtitle: '字幕轨道',
}

export const DEFAULT_UNIFIED_TRACK_CONFIGS = {
  // ...existing
  subtitle: { height: 40, isVisible: true, isMuted: false, color: '#9C27B0' },
}
```

3. **更新能力映射** (`types.ts`)：
```typescript
export const UNIFIED_TRACK_TYPE_CAPABILITIES = {
  // ...existing
  subtitle: {
    supportsVisibility: true,
    supportsMute: false,
    supportsReorder: true,
    supportsResize: true,
    supportsLock: true,
  },
}
```

### 添加新的工具函数

在 `utils.ts` 中添加新函数，然后在 `index.ts` 中导出：

```typescript
// utils.ts
export function newUtilityFunction(track: UnifiedTrack): boolean {
  // 实现逻辑
  return true
}

// index.ts
export { newUtilityFunction } from './utils'
```

## 📚 相关文档

- [重构文档 - 统一时间轴项目设计](../../../docs/重构文档/10-统一时间轴项目设计-类型设计.md)
- [UnifiedTrackModule 使用指南](../../stores/modules/UnifiedTrackModule.example.ts)
- [统一时间轴项目模块](../timelineitem/README.md)

## 🎨 设计优势

1. **职责清晰**：类型、工具函数、导出职责分离
2. **易于维护**：单一职责原则，修改影响范围小
3. **类型安全**：完整的 TypeScript 类型定义
4. **扩展性强**：新增功能只需在对应文件中添加
5. **导入简洁**：统一从 index.ts 导入所需内容
