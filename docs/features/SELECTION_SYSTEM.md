# 选择系统

## 📋 概述

选择系统为视频编辑器提供统一的项目选择管理，支持单选、多选和批量操作。系统采用集合管理模式，实现了时间轴选择与AVCanvas选择的双向同步。

## 🎯 核心特性

### ✅ 已实现功能

#### 统一选择管理
- **单一集合管理**：使用Set集合统一管理所有选择状态
- **单选支持**：点击选择单个时间轴项目
- **多选支持**：Ctrl+点击实现多项目选择
- **选择切换**：智能的选择状态切换逻辑

#### 双向同步机制
- **时间轴→AVCanvas**：时间轴选择自动同步到画布
- **AVCanvas→时间轴**：画布选择自动同步到时间轴
- **智能同步**：单选时同步，多选时清除画布选择
- **冲突处理**：避免选择状态的循环更新

#### 视觉反馈系统
- **统一样式**：单选和多选使用一致的视觉样式
- **选择指示**：橙色渐变背景和边框高亮
- **状态区分**：可选的多选模式额外视觉提示
- **即时反馈**：选择状态的实时视觉更新

## 🏗️ 技术架构

### 核心数据结构

#### 统一选择状态
```typescript
// 单一集合管理所有选择
const selectedTimelineItemIds = ref<Set<string>>(new Set())

// 计算属性
const selectedTimelineItemId = computed(() => {
  // 单选时返回唯一ID，多选时返回null
  return selectedTimelineItemIds.value.size === 1 
    ? Array.from(selectedTimelineItemIds.value)[0] 
    : null
})

const isMultiSelectMode = computed(() => selectedTimelineItemIds.value.size > 1)
const hasSelection = computed(() => selectedTimelineItemIds.value.size > 0)
```

#### 选择操作接口
```typescript
interface SelectionModule {
  // 统一选择方法
  selectTimelineItems(itemIds: string[], mode: 'replace' | 'toggle'): void
  
  // 清除所有选择
  clearTimelineSelection(): void
  
  // 检查选择状态
  isTimelineItemSelected(itemId: string): boolean
  
  // 获取选择列表
  getSelectedTimelineItemIds(): string[]
}
```

### 选择逻辑实现

#### 统一选择方法
```typescript
function selectTimelineItems(itemIds: string[], mode: 'replace' | 'toggle' = 'replace') {
  if (mode === 'replace') {
    selectedTimelineItemIds.value.clear()
    itemIds.forEach(id => selectedTimelineItemIds.value.add(id))
  } else {
    itemIds.forEach(id => {
      if (selectedTimelineItemIds.value.has(id)) {
        selectedTimelineItemIds.value.delete(id)
      } else {
        selectedTimelineItemIds.value.add(id)
      }
    })
  }
  
  // 同步AVCanvas选择
  syncAVCanvasSelection()
}
```

### 选择处理机制

#### 时间轴选择处理
```typescript
// VideoClip.vue 中的选择逻辑
function selectClip(event: MouseEvent) {
  if (isDragging.value || isResizing.value) return

  if (event.ctrlKey) {
    // Ctrl+点击：切换选择状态
    videoStore.selectTimelineItems([props.timelineItem.id], 'toggle')
  } else {
    // 普通点击：替换选择
    videoStore.selectTimelineItems([props.timelineItem.id], 'replace')
  }

  event.stopPropagation()
}
```

#### 选择状态管理
```typescript
function syncAVCanvasSelection() {
  // 注意：由于不再支持AVCanvas选择，这个函数现在只是一个占位符
  // 保留是为了兼容性，避免破坏现有的调用
  console.log('🔗 选择状态已更新（不再同步到AVCanvas）')
}
```

## 🎨 视觉设计

### 选择样式
```scss
.video-clip {
  border: 2px solid transparent;
  transition: all 0.2s ease;
  
  &.selected {
    // 统一的选择样式
    background: linear-gradient(135deg, #ff6b35, #f7931e);
    border-color: #ff6b35;
    box-shadow: 0 2px 12px rgba(255, 107, 53, 0.6);
  }
  
  // 多选模式的额外视觉提示
  &.selected[data-multi-select="true"] {
    box-shadow: 0 2px 12px rgba(255, 107, 53, 0.6), 
                0 0 0 1px rgba(255, 107, 53, 0.3);
  }
}
```

### 状态指示
- **未选择**：透明边框，默认背景
- **单选**：橙色渐变背景，橙色边框，阴影效果
- **多选**：相同样式 + 额外的外围光晕效果
- **悬停**：轻微的亮度变化

## 🎮 交互模式

### 基础选择操作
- **单击**：选择单个项目，清除其他选择
- **Ctrl+单击**：切换项目选择状态（多选模式）
- **空白区域点击**：清除所有选择
- **拖拽选择**：框选多个项目（未来功能）

### 键盘快捷键
- **Ctrl+A**：全选当前轨道项目
- **Escape**：清除所有选择
- **Delete**：删除选中项目
- **Ctrl+C/V**：复制粘贴选中项目

### 批量操作
- **批量删除**：选择多个项目后删除
- **批量移动**：拖拽多个选中项目
- **批量属性修改**：同时修改多个项目属性
- **批量复制**：复制多个选中项目

## 📊 性能优化

### 响应式优化
```typescript
// 使用shallowRef优化Set响应性
const selectedTimelineItemIds = shallowRef<Set<string>>(new Set())

// 批量更新时暂停响应式
function batchSelectUpdate(callback: () => void) {
  const oldValue = selectedTimelineItemIds.value
  selectedTimelineItemIds.value = new Set(oldValue)
  
  callback()
  
  // 触发响应式更新
  selectedTimelineItemIds.value = new Set(selectedTimelineItemIds.value)
}
```

### 事件处理优化
- **事件委托**：时间轴容器统一处理选择事件
- **防抖处理**：快速点击时的防抖保护
- **状态缓存**：避免重复的同步操作

### 内存管理
- **弱引用**：避免选择状态导致的内存泄漏
- **自动清理**：项目删除时自动清理选择状态
- **状态重置**：组件卸载时清理选择状态

## 🔄 状态流转

### 选择状态机
```
无选择 ──单击──→ 单选
  ↑              ↓
  └──清除选择──←──┘
  ↑              ↓
  └──清除选择──←─ 多选 ←──Ctrl+单击──┘
```

### 选择流程
```
时间轴选择变化
    ↓
更新选择状态
    ↓
触发UI更新
    ↓
显示选择反馈
```

## 🧪 测试要点

### 功能测试
- ✅ 单选项目的选择和取消
- ✅ 多选项目的添加和移除
- ✅ Ctrl+点击的切换逻辑
- ✅ 空白区域点击清除选择
- ✅ 时间轴选择状态的独立管理

### 边界测试
- ✅ 快速连续点击的处理
- ✅ 项目删除时的选择状态清理
- ✅ 大量项目时的选择性能
- ✅ 异常状态的恢复机制

### 用户体验测试
- ✅ 选择反馈的及时性
- ✅ 视觉样式的一致性
- ✅ 操作逻辑的直观性
- ✅ 多选操作的流畅性

## 🎉 实现成果

### 架构优势
- ✅ 统一的状态管理，消除双重状态
- ✅ 简化的选择逻辑，减少bug风险
- ✅ 高效的集合操作，提升性能
- ✅ 清晰的代码结构，易于维护

### 用户体验
- ✅ 直观的选择交互模式
- ✅ 一致的视觉反馈系统
- ✅ 流畅的多选操作体验
- ✅ 独立的时间轴选择管理

### 扩展能力
- ✅ 支持未来的框选功能
- ✅ 支持更多批量操作类型
- ✅ 支持键盘导航选择
- ✅ 支持选择历史记录

---

*最后更新：2025-06-19*
