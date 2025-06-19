# 状态设置器迁移指南

## 概述

为了解决状态设置模式重复的问题，我们创建了统一的状态设置工具函数。这个指南将帮助你将现有的状态设置方法迁移到新的统一模式。

## 问题分析

### 原有问题
- **参数验证逻辑重复** - 每个模块都有自己的验证方式
- **状态变化检查重复** - `if (oldValue !== newValue)` 模式重复
- **日志记录格式不统一** - 不同的emoji和格式风格
- **错误处理方式不一致** - 类似的warn/error处理逻辑

### 影响的文件
- `configModule.ts` ✅ 已迁移示例
- `playbackModule.ts` ✅ 已迁移示例
- `webavModule.ts` ⏳ 待迁移
- `trackModule.ts` ⏳ 待迁移
- `selectionModule.ts` ⏳ 待迁移
- `viewportModule.ts` ⏳ 待迁移
- `mediaModule.ts` ⏳ 待迁移

## 迁移步骤

### 1. 导入工具函数

```typescript
import { 
  createStateSetter, 
  createNumberSetter, 
  createBooleanSetter,
  createStringSetter,
  createRangeValidator,
  createPositiveValidator,
  createClampTransformer
} from '../utils/stateSetterUtils'
```

### 2. 创建状态设置器

#### 简单布尔值
```typescript
// 旧方式
function setEnabled(enabled: boolean) {
  if (isEnabled.value !== enabled) {
    isEnabled.value = enabled
    console.log('✅ 设置启用状态:', enabled ? '启用' : '禁用')
  }
}

// 新方式
const setEnabledUnified = createBooleanSetter(
  isEnabled,
  'ModuleName',
  '启用状态',
  '✅'
)

function setEnabled(enabled: boolean) {
  const result = setEnabledUnified(enabled)
  return result.success
}
```

#### 数值范围限制
```typescript
// 旧方式
function setVolume(volume: number) {
  const clampedVolume = Math.max(0, Math.min(1, volume))
  if (currentVolume.value !== clampedVolume) {
    currentVolume.value = clampedVolume
    console.log('🔊 设置音量:', clampedVolume)
  }
}

// 新方式
const setVolumeUnified = createNumberSetter(
  currentVolume,
  'AudioModule',
  '音量',
  0,
  1,
  '🔊'
)

function setVolume(volume: number) {
  const result = setVolumeUnified(volume)
  return result.success
}
```

#### 复杂自定义验证
```typescript
// 旧方式
function setFrameRate(rate: number) {
  if (rate > 0 && rate <= 120) {
    frameRate.value = rate
    console.log('🎬 帧率已设置为:', rate)
  } else {
    console.warn('⚠️ 无效的帧率值:', rate)
  }
}

// 新方式
const setFrameRateUnified = createStateSetter(frameRate, {
  moduleName: 'ConfigModule',
  stateName: '帧率',
  emoji: '🎬',
  validator: createRangeValidator(1, 120, '帧率'),
  transformer: createClampTransformer(1, 120),
  logFormatter: (value, oldValue) => ({
    frameRate: `${value}fps`,
    oldFrameRate: oldValue ? `${oldValue}fps` : undefined,
    changed: oldValue !== value
  })
})

function setFrameRate(rate: number) {
  const result = setFrameRateUnified(rate)
  return result.success
}
```

### 3. 批量状态更新

```typescript
import { createBatchStateSetter } from '../utils/stateSetterUtils'

const batchSetter = createBatchStateSetter({
  moduleName: 'ConfigModule',
  operationName: '重置配置',
  emoji: '🔄'
})

function resetToDefaults() {
  const result = batchSetter(
    {
      frameRate: 30,
      timelineDuration: 60,
      proportionalScale: true
    },
    {
      frameRate: setFrameRateUnified,
      timelineDuration: setTimelineDurationUnified,
      proportionalScale: setProportionalScaleUnified
    }
  )
  
  return result.success
}
```

## 迁移检查清单

### 每个模块需要检查的内容

- [ ] **导入工具函数** - 添加必要的import语句
- [ ] **识别状态设置方法** - 找到所有setXXX方法
- [ ] **分析验证逻辑** - 确定需要的验证器类型
- [ ] **统一日志格式** - 使用一致的emoji和格式
- [ ] **更新方法签名** - 考虑是否需要返回成功状态
- [ ] **测试功能** - 确保迁移后功能正常

### 验证器选择指南

| 场景 | 推荐验证器 | 示例 |
|------|------------|------|
| 数值范围 | `createRangeValidator(min, max)` | 音量(0-1)、帧率(1-120) |
| 正数 | `createPositiveValidator()` | 时长、尺寸 |
| 非空字符串 | `createNonEmptyStringValidator()` | 名称、路径 |
| 枚举值 | `createEnumValidator(values)` | 状态、模式 |
| 自定义 | 自定义函数 | 复杂业务逻辑 |

### 转换器选择指南

| 场景 | 推荐转换器 | 示例 |
|------|------------|------|
| 数值限制 | `createClampTransformer(min, max)` | 音量、速度 |
| 字符串修剪 | `createTrimTransformer()` | 用户输入 |
| 四舍五入 | `createRoundTransformer(decimals)` | 精度控制 |

## 迁移优先级

### 高优先级 (立即迁移)
1. **configModule.ts** ✅ 已完成
2. **playbackModule.ts** ✅ 已完成
3. **webavModule.ts** - 核心功能模块

### 中优先级 (下一批)
4. **trackModule.ts** - 轨道管理
5. **viewportModule.ts** - 视口控制

### 低优先级 (最后迁移)
6. **selectionModule.ts** - 选择管理
7. **mediaModule.ts** - 媒体管理

## 注意事项

1. **向后兼容** - 保持原有方法签名，内部使用新的设置器
2. **错误处理** - 新的设置器返回结果对象，可以检查成功状态
3. **性能影响** - 新的设置器有轻微的性能开销，但提供了更好的一致性
4. **测试覆盖** - 迁移后需要测试所有状态设置功能
5. **渐进迁移** - 可以逐个模块迁移，不需要一次性全部完成

## 下一步行动

1. 完成剩余模块的迁移
2. 更新相关的单元测试
3. 在团队中推广新的状态设置模式
4. 考虑是否需要添加更多的验证器和转换器
