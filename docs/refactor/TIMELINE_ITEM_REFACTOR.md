# TimelineItem 单向数据流重构计划

## 📋 概述

将当前的 TimelineItem ↔ Sprite 双向同步机制重构为 TimelineItem → Sprite 的单向数据流，使用计算属性的 getter/setter 实现自动同步。

## 🎯 重构目标

### 当前问题
- **双向同步复杂**：TimelineItem ↔ Sprite 之间存在复杂的双向同步逻辑
- **数据流混乱**：通过 `propsChange` 事件和 `updateTimelineItemTransform` 方法的双向更新
- **调试困难**：状态变化路径不清晰，难以追踪数据流向
- **性能损耗**：不必要的事件监听和重复的坐标转换

### 目标架构
```
属性面板 → TimelineItem属性 → Sprite属性
         ↑ (getter/setter)    ↑ (自动同步)
    用户输入                WebAV渲染
```

## 🏗️ 技术方案

### 方案选择：工厂函数 + Interface

**选择理由**：
1. 保持现有 `TimelineItem` interface 定义不变
2. 与 Vue3 响应式系统完美兼容
3. 符合 Composition API 函数式编程风格
4. 现有代码无需修改类型定义

### 核心实现

#### 1. TimelineItem Interface（简化设计）
```typescript
export interface TimelineItem {
  id: string
  mediaItemId: string
  trackId: number
  mediaType: 'video' | 'image'
  timeRange: VideoTimeRange | ImageTimeRange
  sprite: Raw<VideoVisibleSprite | ImageVisibleSprite>
  thumbnailUrl?: string

  // 直接的变换属性（通过工厂函数实现 getter/setter）
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  zIndex: number
  volume: number
  isMuted: boolean
}
```

#### 2. 工厂函数实现
```typescript
function createReactiveTimelineItem(
  baseData: TimelineItemBaseData,
  sprite: VideoVisibleSprite | ImageVisibleSprite
): TimelineItem {
  return reactive({
    // 基础属性
    ...baseData,
    sprite: markRaw(sprite),

    // 位置属性
    get x() {
      const rect = sprite.rect
      return webavToProjectCoords(rect.x, rect.y, rect.w, rect.h, videoResolution).x
    },
    set x(value: number) {
      const currentY = this.y
      const webavCoords = projectToWebavCoords(value, currentY, sprite.rect.w, sprite.rect.h, videoResolution)
      sprite.rect.x = webavCoords.x
      sprite.rect.y = webavCoords.y
    },

    get y() {
      const rect = sprite.rect
      return webavToProjectCoords(rect.x, rect.y, rect.w, rect.h, videoResolution).y
    },
    set y(value: number) {
      const currentX = this.x
      const webavCoords = projectToWebavCoords(currentX, value, sprite.rect.w, sprite.rect.h, videoResolution)
      sprite.rect.x = webavCoords.x
      sprite.rect.y = webavCoords.y
    },

    // 尺寸属性
    get width() {
      return sprite.rect.w
    },
    set width(value: number) {
      sprite.rect.w = value
    },

    get height() {
      return sprite.rect.h
    },
    set height(value: number) {
      sprite.rect.h = value
    },

    // 其他计算属性...
  })
}
```

## ✅ 实施完成状态

### 阶段1：创建新的 TimelineItem 系统 ✅ 已完成
**目标**：建立新的工厂函数，保持现有功能正常

**已完成任务**：
- ✅ 创建 `createReactiveTimelineItem` 工厂函数
- ✅ 实现所有属性的 getter/setter 逻辑
- ✅ 在 Timeline.vue 中使用新工厂函数
- ✅ 确保现有功能正常工作

**已修改文件**：
- ✅ `frontend/src/utils/timelineItemFactory.ts`（已创建）
- ✅ `frontend/src/components/Timeline.vue`

### 阶段2：更新属性面板 ✅ 已完成
**目标**：简化属性面板代码，使用直接属性赋值

**已完成任务**：
- ✅ 修改 PropertiesPanel.vue 中的更新方法
- ✅ 移除对 `updateTimelineItemTransform` 的调用
- ✅ 保留 `updatePropertyWithHistory` 用于用户操作历史记录
- ✅ 测试所有属性修改功能

**已修改文件**：
- ✅ `frontend/src/components/PropertiesPanel.vue`

### 阶段3：移除双向同步代码 ✅ 已完成
**目标**：清理旧的双向同步逻辑

**已完成任务**：
- ✅ 移除 `setupBidirectionalSync` 方法及其调用
- ✅ 删除 `updateTimelineItemTransform` 方法
- ✅ 清理不再使用的双向同步代码
- ✅ 移除相关的事件监听器

**已修改文件**：
- ✅ `frontend/src/stores/modules/timelineModule.ts`

### 阶段4：验证和优化 ✅ 已完成
**目标**：确保重构后系统稳定可靠

**已完成任务**：
- ✅ 全面测试所有属性修改功能
- ✅ 验证历史记录系统兼容性
- ✅ 更新所有命令类使用新架构
- ✅ 代码清理和文档更新

## 📊 预期收益

### 代码质量提升
- **简化逻辑**：移除复杂的双向同步机制
- **清晰数据流**：单向数据流，易于理解和调试
- **减少代码量**：移除不必要的事件监听和转换逻辑

### 性能优化
- **减少事件监听**：移除 `propsChange` 事件监听器
- **避免重复计算**：减少不必要的坐标转换
- **响应式优化**：更好地利用 Vue 的响应式系统

### 维护性改善
- **调试简单**：数据变化路径清晰可追踪
- **扩展容易**：新增属性只需在 getter/setter 中定义
- **测试友好**：单向数据流更容易编写单元测试

## 🚨 注意事项

### 兼容性考虑
- **历史记录系统**：确保操作历史能正确记录属性变化
- **类型安全**：保持 TypeScript 类型推断的完整性
- **响应式边界**：正确使用 `markRaw` 避免 Sprite 被响应式包装

### 坐标转换
- **精度保持**：确保项目坐标与 WebAV 坐标转换的精度
- **性能优化**：在 getter/setter 中优化坐标转换逻辑
- **边界处理**：处理坐标转换的边界情况

### 测试策略
- **单元测试**：为工厂函数编写完整的单元测试
- **集成测试**：测试属性面板与 TimelineItem 的集成
- **回归测试**：确保现有功能不受影响

## 📈 成功指标

- [ ] 所有属性修改功能正常工作
- [ ] 代码行数减少 20% 以上
- [ ] 性能测试显示响应时间改善
- [ ] 无回归问题
- [ ] 代码可读性和可维护性提升
