import { type Ref } from 'vue'

// ==================== 类型定义 ====================

/**
 * 状态设置选项
 */
export interface StateSetterOptions<T> {
  /** 模块名称，用于日志前缀 */
  moduleName: string
  /** 状态名称，用于日志描述 */
  stateName: string
  /** 自定义日志emoji，默认为⚙️ */
  emoji?: string
  /** 是否启用详细日志，默认true */
  enableLogging?: boolean
  /** 是否检查状态变化，只有变化时才更新，默认true */
  checkChange?: boolean
  /** 自定义验证函数 */
  validator?: (value: T) => boolean | string
  /** 自定义值转换函数 */
  transformer?: (value: T) => T
  /** 自定义日志格式化函数 */
  logFormatter?: (value: T, oldValue?: T) => Record<string, unknown>
}

/**
 * 批量状态设置选项
 */
export interface BatchStateSetterOptions {
  /** 模块名称 */
  moduleName: string
  /** 操作描述 */
  operationName: string
  /** 自定义日志emoji */
  emoji?: string
  /** 是否启用日志 */
  enableLogging?: boolean
}

/**
 * 状态设置结果
 */
export interface StateSetterResult<T> {
  /** 是否成功设置 */
  success: boolean
  /** 最终设置的值 */
  finalValue?: T
  /** 错误信息（如果有） */
  error?: string
  /** 是否发生了状态变化 */
  changed?: boolean
}

// ==================== 核心状态设置函数 ====================

/**
 * 统一的状态设置函数
 * 提供一致的验证、更新、日志记录模式
 */
export function createStateSetter<T>(
  stateRef: Ref<T>,
  options: StateSetterOptions<T>
): (value: T) => StateSetterResult<T> {
  const {
    moduleName,
    stateName,
    emoji = '⚙️',
    enableLogging = true,
    checkChange = true,
    validator,
    transformer,
    logFormatter
  } = options

  return (value: T): StateSetterResult<T> => {
    const oldValue = stateRef.value

    try {
      // 1. 参数验证
      if (validator) {
        const validationResult = validator(value)
        if (validationResult !== true) {
          const errorMessage = typeof validationResult === 'string' 
            ? validationResult 
            : `无效的${stateName}值`
          
          if (enableLogging) {
            console.warn(`⚠️ [${moduleName}] ${errorMessage}:`, value)
          }
          
          return {
            success: false,
            error: errorMessage,
            changed: false
          }
        }
      }

      // 2. 值转换
      const finalValue = transformer ? transformer(value) : value

      // 3. 状态变化检查
      if (checkChange && stateRef.value === finalValue) {
        if (enableLogging) {
          console.log(`${emoji} [${moduleName}] ${stateName}值未变化，跳过更新:`, finalValue)
        }
        return {
          success: true,
          finalValue,
          changed: false
        }
      }

      // 4. 更新状态
      stateRef.value = finalValue

      // 5. 记录日志
      if (enableLogging) {
        const logData = logFormatter 
          ? logFormatter(finalValue, oldValue)
          : {
              stateName,
              oldValue,
              newValue: finalValue,
              changed: oldValue !== finalValue
            }

        console.log(`${emoji} [${moduleName}] 设置${stateName}:`, logData)
      }

      return {
        success: true,
        finalValue,
        changed: oldValue !== finalValue
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      if (enableLogging) {
        console.error(`❌ [${moduleName}] 设置${stateName}失败:`, errorMessage)
      }

      return {
        success: false,
        error: errorMessage,
        changed: false
      }
    }
  }
}

// ==================== 常用验证器 ====================

/**
 * 数值范围验证器
 */
export function createRangeValidator(min: number, max: number, name?: string) {
  return (value: number): boolean | string => {
    if (typeof value !== 'number' || isNaN(value)) {
      return `${name || '值'}必须是有效数字`
    }
    if (value < min || value > max) {
      return `${name || '值'}必须在 ${min} 到 ${max} 之间`
    }
    return true
  }
}

/**
 * 正数验证器
 */
export function createPositiveValidator(name?: string) {
  return (value: number): boolean | string => {
    if (typeof value !== 'number' || isNaN(value)) {
      return `${name || '值'}必须是有效数字`
    }
    if (value <= 0) {
      return `${name || '值'}必须大于0`
    }
    return true
  }
}

/**
 * 非空字符串验证器
 */
export function createNonEmptyStringValidator(name?: string) {
  return (value: string): boolean | string => {
    if (typeof value !== 'string') {
      return `${name || '值'}必须是字符串`
    }
    if (value.trim().length === 0) {
      return `${name || '值'}不能为空`
    }
    return true
  }
}

/**
 * 枚举值验证器
 */
export function createEnumValidator<T>(allowedValues: T[], name?: string) {
  return (value: T): boolean | string => {
    if (!allowedValues.includes(value)) {
      return `${name || '值'}必须是以下值之一: ${allowedValues.join(', ')}`
    }
    return true
  }
}

// ==================== 常用转换器 ====================

/**
 * 数值范围限制转换器
 */
export function createClampTransformer(min: number, max: number) {
  return (value: number): number => {
    return Math.max(min, Math.min(max, value))
  }
}

/**
 * 字符串修剪转换器
 */
export function createTrimTransformer() {
  return (value: string): string => {
    return value.trim()
  }
}

/**
 * 四舍五入转换器
 */
export function createRoundTransformer(decimals: number = 0) {
  return (value: number): number => {
    const factor = Math.pow(10, decimals)
    return Math.round(value * factor) / factor
  }
}

// ==================== 批量状态设置 ====================

/**
 * 批量状态设置函数
 * 用于同时设置多个相关状态
 */
export function createBatchStateSetter(options: BatchStateSetterOptions) {
  const { moduleName, operationName, emoji = '📦', enableLogging = true } = options

  return function executeBatch<T extends Record<string, unknown>>(
    updates: T,
    setters: { [K in keyof T]: (value: T[K]) => StateSetterResult<T[K]> }
  ): { success: boolean; results: { [K in keyof T]: StateSetterResult<T[K]> }; errors: string[] } {

    if (enableLogging) {
      console.group(`${emoji} [${moduleName}] 开始批量操作: ${operationName}`)
    }

    const results = {} as { [K in keyof T]: StateSetterResult<T[K]> }
    const errors: string[] = []
    let overallSuccess = true

    // 执行所有更新
    for (const [key, value] of Object.entries(updates)) {
      const setter = setters[key as keyof T]
      if (setter) {
        const result = setter(value as T[keyof T])
        results[key as keyof T] = result

        if (!result.success) {
          overallSuccess = false
          if (result.error) {
            errors.push(`${String(key)}: ${result.error}`)
          }
        }
      }
    }

    if (enableLogging) {
      const changedCount = Object.values(results).filter(r => r.changed).length
      const successCount = Object.values(results).filter(r => r.success).length

      console.log(`📊 批量操作结果:`, {
        operationName,
        totalUpdates: Object.keys(updates).length,
        successCount,
        changedCount,
        errorCount: errors.length,
        overallSuccess
      })

      if (errors.length > 0) {
        console.warn('⚠️ 批量操作中的错误:', errors)
      }

      console.groupEnd()
    }

    return {
      success: overallSuccess,
      results,
      errors
    }
  }
}

// ==================== 预设状态设置器工厂 ====================

/**
 * 创建布尔状态设置器
 */
export function createBooleanSetter(
  stateRef: Ref<boolean>,
  moduleName: string,
  stateName: string,
  emoji?: string
) {
  return createStateSetter(stateRef, {
    moduleName,
    stateName,
    emoji,
    logFormatter: (value, oldValue) => ({
      [stateName]: value ? '启用' : '禁用',
      changed: oldValue !== value
    })
  })
}

/**
 * 创建数值状态设置器（带范围限制）
 */
export function createNumberSetter(
  stateRef: Ref<number>,
  moduleName: string,
  stateName: string,
  min: number,
  max: number,
  emoji?: string
) {
  return createStateSetter(stateRef, {
    moduleName,
    stateName,
    emoji,
    validator: createRangeValidator(min, max, stateName),
    transformer: createClampTransformer(min, max),
    logFormatter: (value, oldValue) => ({
      [stateName]: value,
      oldValue,
      range: `${min}-${max}`,
      changed: oldValue !== value
    })
  })
}

/**
 * 创建字符串状态设置器（非空）
 */
export function createStringSetter(
  stateRef: Ref<string>,
  moduleName: string,
  stateName: string,
  emoji?: string
) {
  return createStateSetter(stateRef, {
    moduleName,
    stateName,
    emoji,
    validator: createNonEmptyStringValidator(stateName),
    transformer: createTrimTransformer(),
    logFormatter: (value, oldValue) => ({
      [stateName]: value,
      oldValue,
      length: value.length,
      changed: oldValue !== value
    })
  })
}
