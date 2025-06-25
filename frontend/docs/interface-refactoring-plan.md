# Interface类型定义重构计划

## 🎯 重构目标

将分散在各个文件中的interface定义集中到统一的类型定义文件中，提高代码的可维护性和一致性。

## 📊 当前问题分析

### 分散的接口定义位置

1. **`src/types/videoTypes.ts`** - 核心数据类型
2. **`src/utils/VideoVisibleSprite.ts`** - 视频时间范围接口
3. **`src/utils/ImageVisibleSprite.ts`** - 图片时间范围接口
4. **`src/stores/modules/historyModule.ts`** - 命令模式接口
5. **`src/composables/useWebAVControls.ts`** - WebAV控制接口
6. **`src/stores/modules/commands/timelineCommands.ts`** - 命令数据接口
7. **`src/types/global.d.ts`** - 全局类型扩展
8. **`src/utils/webavDebug.ts`** - 调试工具常量

### 存在的问题

- ❌ **分散管理** - 接口定义分布在8个不同文件中
- ❌ **重复导入** - 需要从多个文件导入相关类型
- ❌ **依赖混乱** - 类型定义和实现代码混合
- ❌ **维护困难** - 修改接口需要在多个文件中查找

## 🏗️ 重构方案

### 新的文件结构

```
src/types/
├── index.ts           # 统一的类型定义入口
├── global.d.ts        # 全局类型扩展（保留）
└── legacy/            # 旧文件的备份（重构完成后删除）
    ├── videoTypes.ts
    └── ...
```

### 重构步骤

#### 阶段1：创建统一类型文件 ✅

- [x] 创建 `src/types/index.ts`
- [x] 整合所有interface定义到统一文件
- [x] 添加详细的注释和分类

#### 阶段2：更新导入语句

需要更新以下文件的导入语句：

1. **Store模块** (8个文件)
   - `src/stores/videoStore.ts`
   - `src/stores/modules/*.ts`

2. **Composables** (6个文件)
   - `src/composables/*.ts`

3. **Components** (12个文件)
   - `src/components/*.vue`

4. **Utils** (6个文件)
   - `src/utils/*.ts`

#### 阶段3：清理旧文件

- 移除旧文件中的interface定义
- 保留实现代码
- 更新导入语句

#### 阶段4：验证和测试

- 确保所有类型导入正常
- 运行类型检查
- 测试应用功能

## 📝 具体重构任务

### 高优先级文件（核心依赖）

1. **`src/types/videoTypes.ts`**
   ```typescript
   // 移除所有interface定义，只保留类型守卫函数
   // 更新导入：从 './index' 导入所有类型
   ```

2. **`src/utils/VideoVisibleSprite.ts`**
   ```typescript
   // 移除 VideoTimeRange, AudioState 接口定义
   // 更新导入：import type { VideoTimeRange, AudioState } from '../types'
   ```

3. **`src/utils/ImageVisibleSprite.ts`**
   ```typescript
   // 移除 ImageTimeRange 接口定义
   // 更新导入：import type { ImageTimeRange } from '../types'
   ```

### 中优先级文件（Store模块）

4. **`src/stores/modules/historyModule.ts`**
   ```typescript
   // 移除 SimpleCommand, NotificationManager 接口定义
   // 更新导入：import type { SimpleCommand, NotificationManager } from '../../types'
   ```

5. **`src/stores/modules/commands/timelineCommands.ts`**
   ```typescript
   // 移除 TimelineItemData, TransformData 接口定义
   // 更新导入：import type { TimelineItemData, TransformData } from '../../../types'
   ```

### 低优先级文件（其他模块）

6. **`src/composables/useWebAVControls.ts`**
   ```typescript
   // 移除 PlayOptions, CanvasBackup 接口定义
   // 更新导入：import type { PlayOptions, CanvasBackup } from '../types'
   ```

7. **`src/utils/webavDebug.ts`**
   ```typescript
   // 移除 DEBUG_GROUPS 常量定义
   // 更新导入：import { DEBUG_GROUPS } from '../types'
   ```

## 🔄 迁移指南

### 旧的导入方式
```typescript
// 分散导入
import type { MediaItem, TimelineItem } from '../types/videoTypes'
import type { VideoTimeRange } from '../utils/VideoVisibleSprite'
import type { SimpleCommand } from '../stores/modules/historyModule'
```

### 新的导入方式
```typescript
// 统一导入
import type { 
  MediaItem, 
  TimelineItem, 
  VideoTimeRange, 
  SimpleCommand 
} from '../types'
```

## ⚠️ 注意事项

1. **保持向后兼容** - 重构期间保留旧的导入方式
2. **分批进行** - 按优先级分批更新，避免大规模破坏性更改
3. **类型检查** - 每个阶段完成后运行 `npm run type-check`
4. **测试验证** - 确保应用功能正常工作

## 📈 预期收益

- ✅ **统一管理** - 所有类型定义集中在一个文件
- ✅ **简化导入** - 只需从一个位置导入所有类型
- ✅ **提高维护性** - 修改接口只需在一个地方
- ✅ **更好的IDE支持** - 统一的类型定义提供更好的自动补全
- ✅ **减少重复** - 避免重复定义相同的接口

## 🚀 开始重构

准备好开始重构了吗？我们可以按照上述计划逐步进行：

1. 首先更新核心文件的导入语句
2. 然后更新Store模块
3. 最后更新其他模块
4. 清理旧的接口定义

每个步骤完成后都会进行验证，确保不会破坏现有功能。
