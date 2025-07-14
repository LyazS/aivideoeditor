# TypeScript 类型错误最小修改方案

## 问题分析
当前 `videoStore.getTimelineItem()` 返回联合类型 `LocalTimelineItem | AsyncProcessingTimelineItem | undefined`，但大部分业务逻辑只需要处理 `LocalTimelineItem`，导致类型不兼容错误。

## 解决策略
在 videoStore 中添加 `getLocalTimelineItem()` 方法，在明确需要本地项目的地方使用此方法。

## 具体修改

### 1. 在 videoStore.ts 中添加新方法

```typescript
// 在 videoStore.ts 中添加
getLocalTimelineItem(id: string): LocalTimelineItem | undefined {
  const item = this.getTimelineItem(id)
  return item && 'mediaName' in item ? item as LocalTimelineItem : undefined
}
```

### 2. 修改调用点

#### src/composables/useWebAVControls.ts
**位置**: 第707行附近
```typescript
// 当前代码
const syncTimelineItem = videoStore.getTimelineItem(timelineItemId)
if (syncTimelineItem) {
    videoStore.setupBidirectionalSync(syncTimelineItem)
}

// 修改为
const syncTimelineItem = videoStore.getLocalTimelineItem(timelineItemId)
if (syncTimelineItem) {
    videoStore.setupBidirectionalSync(syncTimelineItem)
}
```

#### src/components/TimelineTextClipProperties.vue
**位置**: 第645行和第684行
```typescript
// 当前代码
getTimelineItem: videoStore.getTimelineItem,

// 修改为
getTimelineItem: (id: string) => videoStore.getLocalTimelineItem(id),
```

#### src/composables/useUnifiedKeyframeUI.ts
**位置**: 第290行附近
```typescript
// 当前代码
getTimelineItem: videoStore.getTimelineItem,

// 修改为
getTimelineItem: (id: string) => videoStore.getLocalTimelineItem(id),
```

#### src/utils/keyframeCommandUtils.ts
**位置**: 第150行附近
```typescript
// 当前代码
getTimelineItem: (id: string) => videoStore.getTimelineItem(id),

// 修改为
getTimelineItem: (id: string) => videoStore.getLocalTimelineItem(id),
```

#### src/stores/videoStore.ts 中的命令模块调用
**位置**: 第891行、第935行附近
```typescript
// 当前代码
getTimelineItem: timelineModule.getTimelineItem,

// 修改为
getTimelineItem: (id: string) => {
  const item = timelineModule.getTimelineItem(id)
  return item && 'mediaName' in item ? item as LocalTimelineItem : undefined
},
```

### 3. 添加类型守卫函数（可选）

```typescript
// 在 types/index.ts 或 utils/ 中添加
export function isLocalTimelineItem(item: any): item is LocalTimelineItem {
  return item && typeof item === 'object' && 'mediaName' in item
}

export function isAsyncProcessingItem(item: any): item is AsyncProcessingTimelineItem {
  return item && typeof item === 'object' && 'processingType' in item
}
```

## 修改统计

- **新增方法**: 1个 (`getLocalTimelineItem`)
- **修改调用点**: 约6-8个位置
- **总修改量**: 少于15行代码

## 方案优势

1. **最小侵入**: 只修改真正需要本地项目的地方
2. **语义清晰**: 方法名明确表达意图
3. **类型安全**: 避免联合类型的复杂性
4. **向后兼容**: 保留原有方法
5. **业务正确**: 符合业务逻辑语义

## 验证方法

修改完成后运行：
```bash
npm run type-check
```

应该能解决大部分与 `getTimelineItem` 相关的类型错误。

## 后续优化

如果还有其他类型错误，可以考虑：
1. 为其他工具函数提供本地项目版本
2. 在组件props传递时添加类型过滤
3. 为特定场景添加更精确的类型方法
