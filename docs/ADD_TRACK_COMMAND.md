# AddTrackCommand 实现文档

## 📋 概述

AddTrackCommand 是操作记录系统中用于添加轨道的命令类，支持撤销/重做功能。该命令采用简单的添加/删除逻辑，不涉及复杂的WebAV对象重建，是轨道管理操作的基础命令。

## 🎯 功能特性

### 核心功能
- ✅ 支持添加新轨道到时间轴
- ✅ 支持自定义轨道名称或使用默认名称
- ✅ 支持撤销/重做操作
- ✅ 简单可靠的实现逻辑
- ✅ 完整的错误处理

### 技术特点
- ✅ 轻量级实现，无需WebAV对象重建
- ✅ 直接调用trackModule的原生方法
- ✅ 保存轨道数据用于撤销操作
- ✅ 支持异步操作
- ✅ 详细的操作日志

## 🏗️ 架构设计

### 类结构
```typescript
export class AddTrackCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private newTrackId: number = 0 // 新创建的轨道ID
  private trackData: Track // 保存轨道数据
}
```

### 核心方法
1. **execute()**: 执行添加轨道操作
2. **undo()**: 撤销添加轨道操作
3. **get createdTrackId()**: 获取新创建的轨道ID

## 🔄 实现逻辑

### 执行流程
```typescript
async execute(): Promise<void> {
  // 1. 调用trackModule的addTrack方法
  const newTrack = this.trackModule.addTrack(this.trackName)
  
  // 2. 保存轨道数据用于撤销
  this.newTrackId = newTrack.id
  this.trackData = { ...newTrack }
}
```

### 撤销流程
```typescript
async undo(): Promise<void> {
  // 删除添加的轨道
  // 注意：新添加的轨道上不应该有任何项目，所以传入空的timelineItems
  this.trackModule.removeTrack(this.newTrackId, { value: [] }, undefined)
}
```

## 📍 设计考虑

### 简化原则
- **无需重建**: 轨道添加不涉及WebAV对象，无需"从源头重建"
- **直接调用**: 直接使用trackModule的原生方法，保持一致性
- **最小依赖**: 只依赖trackModule，无需其他模块

### 数据管理
- **ID获取**: 在execute时获取实际的轨道ID
- **数据保存**: 保存完整的轨道数据用于撤销
- **状态同步**: 通过trackModule自动同步到Vue响应式状态

## 🔧 集成方式

### videoStore集成
```typescript
async function addTrackWithHistory(name?: string): Promise<number | null> {
  const command = new AddTrackCommand(
    name,
    {
      addTrack: trackModule.addTrack,
      removeTrack: trackModule.removeTrack,
      getTrack: trackModule.getTrack,
    }
  )
  
  await historyModule.executeCommand(command)
  return command.createdTrackId
}
```

### UI组件集成
```typescript
// Timeline.vue
async function addNewTrack() {
  try {
    const newTrackId = await videoStore.addTrackWithHistory()
    if (newTrackId) {
      console.log('✅ 轨道添加成功，新轨道ID:', newTrackId)
    }
  } catch (error) {
    console.error('❌ 添加轨道时出错:', error)
  }
}
```

## 🧪 测试覆盖

### 测试用例
- ✅ 基本添加轨道功能测试
- ✅ 撤销操作测试
- ✅ 自定义名称和默认名称测试
- ✅ 错误处理测试（添加失败、删除失败）
- ✅ 多次执行和撤销测试
- ✅ 不同轨道名称处理测试
- ✅ 轨道数据保存测试

### 测试文件
- `frontend/src/tests/addTrackCommand.test.ts`

## 🚀 使用示例

### 基本使用
```typescript
// 添加默认名称的轨道
const newTrackId = await videoStore.addTrackWithHistory()

// 添加自定义名称的轨道
const customTrackId = await videoStore.addTrackWithHistory('音频轨道')
```

### 撤销/重做
```typescript
// 撤销添加轨道操作
await videoStore.undo()

// 重做添加轨道操作
await videoStore.redo()
```

## ⚠️ 注意事项

### 设计限制
1. **新轨道清洁**: 撤销时假设新添加的轨道上没有任何时间轴项目
2. **ID依赖**: 依赖trackModule的ID生成逻辑
3. **同步操作**: 轨道状态通过trackModule自动同步

### 错误处理
- trackModule.addTrack失败时抛出错误
- trackModule.removeTrack失败时抛出错误
- 提供详细的错误信息和日志

### 性能考虑
- 轻量级操作，性能影响极小
- 无异步WebAV操作，响应迅速
- 内存占用最小

## 📈 后续优化方向

1. **批量操作**: 支持同时添加多个轨道
2. **轨道模板**: 支持基于模板创建轨道
3. **位置控制**: 支持在指定位置插入轨道
4. **属性预设**: 支持预设轨道属性（高度、可见性等）
5. **智能命名**: 更智能的默认命名策略

## 🔗 相关命令

### 已实现
- **AddTrackCommand** - 添加轨道 ✅

### 计划实现
- **RemoveTrackCommand** - 删除轨道
- **RenameTrackCommand** - 重命名轨道
- **ToggleTrackVisibilityCommand** - 切换轨道可见性
- **ToggleTrackMuteCommand** - 切换轨道静音

## 📝 更新日志

### v1.0.0 (2025-06-17)
- ✅ 初始实现AddTrackCommand
- ✅ 支持自定义和默认轨道名称
- ✅ 集成到操作记录系统
- ✅ 添加完整的测试覆盖
- ✅ 更新UI组件使用新的添加方法
- ✅ 创建详细的实现文档
