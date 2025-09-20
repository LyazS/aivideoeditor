/**
 * 工具标签配置接口
 */
export interface ToolConfig {
  name: string
  requiredParams: string[]
  optionalParams: string[]
  arrayParams?: string[] // 数组型参数名称
  arrayElementName?: string // 数组元素参数名称
  validateParams: (params: Record<string, string | string[]>) => string[]
  title: string // 工具显示标题
  icon: string // 工具图标
  getParams: (params: Record<string, string | string[]>) => string // 参数显示逻辑
}

/**
 * 工具标签配置映射
 */
export const TOOL_CONFIGS: Record<string, ToolConfig> = {
  'list_contents': {
    name: 'list_contents',
    title: '列出目录',
    icon: 'folder-line',
    requiredParams: ['path'],
    optionalParams: ['recursive'],
    getParams: (params: Record<string, string | string[]>) => {
      const path = Array.isArray(params.path) ? params.path[0] : params.path
      if (!path) return ''
      
      const paramStrs = [`路径: ${path}`]
      const recursive = Array.isArray(params.recursive) ? params.recursive[0] : params.recursive
      if (recursive === 'true') {
        paramStrs.push('递归')
      }
      return `(${paramStrs.join(', ')})`
    },
    validateParams: (params) => {
      const errors: string[] = []
      const pathValue = Array.isArray(params.path) ? params.path[0] : params.path
      if (!pathValue?.trim()) {
        errors.push('path 参数不能为空')
      }
      const recursiveValue = Array.isArray(params.recursive) ? params.recursive[0] : params.recursive
      if (recursiveValue && !['true', 'false'].includes(recursiveValue as string)) {
        errors.push('recursive 参数必须是 true 或 false')
      }
      return errors
    }
  },
  'read_content': {
    name: 'read_content',
    title: '读取文件',
    icon: 'file-text-line',
    requiredParams: ['path'],
    optionalParams: ['start_line', 'end_line'],
    getParams: (params: Record<string, string | string[]>) => {
      const path = Array.isArray(params.path) ? params.path[0] : params.path
      if (!path) return ''
      
      const paramStrs = [`路径: ${path}`]
      const startLine = Array.isArray(params.start_line) ? params.start_line[0] : params.start_line
      const endLine = Array.isArray(params.end_line) ? params.end_line[0] : params.end_line
      
      if (startLine || endLine) {
        const start = startLine || '开始'
        const end = endLine || '结束'
        paramStrs.push(`行 ${start}-${end}`)
      }
      return `(${paramStrs.join(', ')})`
    },
    validateParams: (params) => {
      const errors: string[] = []
      const pathValue = Array.isArray(params.path) ? params.path[0] : params.path
      if (!pathValue?.trim()) {
        errors.push('path 参数不能为空')
      }
      const startLineValue = Array.isArray(params.start_line) ? params.start_line[0] : params.start_line
      if (startLineValue && isNaN(Number(startLineValue))) {
        errors.push('start_line 参数必须是数字')
      }
      const endLineValue = Array.isArray(params.end_line) ? params.end_line[0] : params.end_line
      if (endLineValue && isNaN(Number(endLineValue))) {
        errors.push('end_line 参数必须是数字')
      }
      if (startLineValue && endLineValue && Number(startLineValue) > Number(endLineValue)) {
        errors.push('start_line 不能大于 end_line')
      }
      return errors
    }
  },
  'search_contents': {
    name: 'search_contents',
    title: '搜索文件',
    icon: 'search-line',
    requiredParams: ['path', 'regex'],
    optionalParams: ['file_patterns'],
    arrayParams: ['file_patterns'], // file_patterns 是数组型参数
    arrayElementName: 'file_pattern', // 数组元素标签名是 file_pattern
    getParams: (params: Record<string, string | string[]>) => {
      const paramStrs = []
      
      const path = Array.isArray(params.path) ? params.path[0] : params.path
      if (path) {
        paramStrs.push(`路径: ${path}`)
      }
      
      const regex = Array.isArray(params.regex) ? params.regex[0] : params.regex
      if (regex) {
        paramStrs.push(`正则: ${regex}`)
      }
      
      // 处理数组型的 file_pattern
      const filePatterns = params.file_pattern
      if (filePatterns) {
        const patterns = Array.isArray(filePatterns) ? filePatterns : [filePatterns]
        if (patterns.length > 0) {
          paramStrs.push(`模式: ${patterns.join(', ')}`)
        }
      }
      
      return paramStrs.length > 0 ? `(${paramStrs.join(', ')})` : ''
    },
    validateParams: (params) => {
      const errors: string[] = []
      const pathValue = Array.isArray(params.path) ? params.path[0] : params.path
      if (!pathValue?.trim()) {
        errors.push('path 参数不能为空')
      }
      const regexValue = Array.isArray(params.regex) ? params.regex[0] : params.regex
      if (!regexValue?.trim()) {
        errors.push('regex 参数不能为空')
      }
      
      // 验证数组中的 file_patterns 元素
      const filePatterns = params.file_patterns
      if (filePatterns) {
        const patterns = Array.isArray(filePatterns) ? filePatterns : [filePatterns]
        for (const pattern of patterns) {
          if (pattern && !(pattern as string).includes('*')) {
            errors.push(`file_patterns "${pattern}" 应该包含通配符 *`)
          }
        }
      }
      return errors
    }
  }
}

/**
 * 获取工具配置
 */
export function getToolConfig(toolName: string): ToolConfig | null {
  return TOOL_CONFIGS[toolName] || null
}

/**
 * 验证工具标签的完整性和正确性
 */
export function validateToolTag(toolName: string, params: Record<string, string | string[]>, content: string): string[] {
  const config = getToolConfig(toolName)
  if (!config) {
    return [`不支持的工具标签: ${toolName}`]
  }

  const errors: string[] = []

  // 验证必需参数
  for (const requiredParam of config.requiredParams) {
    const value = params[requiredParam]
    if (!value || (Array.isArray(value) ? value.length === 0 : !value.toString().trim())) {
      errors.push(`缺少必需参数: ${requiredParam}`)
    }
  }

  // 验证参数值
  errors.push(...config.validateParams(params))

  return errors
}

/**
 * 获取工具组件配置（用于UI显示）
 */
export function getToolComponentConfig(toolType: string): Pick<ToolConfig, 'title' | 'icon' | 'getParams'> {
  const config = TOOL_CONFIGS[toolType]
  if (config) {
    return {
      title: config.title,
      icon: config.icon,
      getParams: config.getParams
    }
  }
  
  // 默认配置
  return {
    title: '未知工具',
    icon: 'question-line',
    getParams: () => ''
  }
}