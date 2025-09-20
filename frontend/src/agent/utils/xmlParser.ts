import { validateToolTag, getToolConfig, TOOL_CONFIGS } from './toolConfigs'

export interface ParsedContent {
  type: 'text' | 'tool'
  content: string
  toolName?: string
  params?: Record<string, string | string[]>  // 改为params，支持字符串和字符串数组
  toolContent?: string
  validationErrors?: string[] // 验证错误信息
}

export interface ToolTag {
  name: string
  params: Record<string, string | string[]>    // 改为params
  content: string
  startIndex: number
  endIndex: number
  validationErrors?: string[] // 验证错误信息
}

/**
 * 解析XML工具标签（新格式 - 子标签方式）
 * @param content 原始消息内容
 * @returns 解析后的内容片段数组
 */
export function parseXmlToolTags(content: string): ParsedContent[] {
  const result: ParsedContent[] = []
  const processedRanges: Array<{ start: number; end: number }> = []
  
  // 获取所有支持的工具
  const supportedTools = Object.keys(TOOL_CONFIGS)
  
  // 为每个工具单独解析
  for (const toolName of supportedTools) {
    const toolMatches = parseToolByName(content, toolName)
    
    for (const match of toolMatches) {
      // 检查是否与其他工具匹配冲突
      const hasConflict = processedRanges.some(range =>
        (match.startIndex >= range.start && match.startIndex < range.end) ||
        (match.endIndex > range.start && match.endIndex <= range.end)
      )
      
      if (hasConflict) {
        continue // 跳过冲突的匹配
      }
      
      // 验证工具标签
      const validationErrors = validateToolTag(toolName, match.params, match.content)
      
      // 添加到结果（暂时不添加，先收集所有匹配）
      processedRanges.push({ start: match.startIndex, end: match.endIndex })
    }
  }
  
  // 按位置排序所有匹配
  processedRanges.sort((a, b) => a.start - b.start)
  
  let currentIndex = 0
  
  // 重新处理内容，这次添加文本和工具标签
  for (const range of processedRanges) {
    // 添加前面的文本内容
    if (range.start > currentIndex) {
      const textContent = content.slice(currentIndex, range.start)
      if (textContent.trim()) {
        result.push({
          type: 'text',
          content: textContent
        })
      }
    }
    
    // 找到对应的工具匹配
    for (const toolName of supportedTools) {
      const toolMatches = parseToolByName(content, toolName)
      const match = toolMatches.find(m => m.startIndex === range.start && m.endIndex === range.end)
      
      if (match) {
        const validationErrors = validateToolTag(toolName, match.params, match.content)
        
        result.push({
          type: 'tool',
          content: match.fullMatch,
          toolName: toolName,
          params: match.params,
          toolContent: match.content,
          validationErrors: validationErrors.length > 0 ? validationErrors : undefined
        })
        break
      }
    }
    
    currentIndex = range.end
  }
  
  // 添加剩余的文本内容
  if (currentIndex < content.length) {
    const remainingContent = content.slice(currentIndex)
    if (remainingContent.trim()) {
      result.push({
        type: 'text',
        content: remainingContent
      })
    }
  }
  
  return result
}

/**
 * 根据工具名称解析工具标签（新格式）
 */
function parseToolByName(content: string, toolName: string): Array<{
  fullMatch: string
  params: Record<string, string | string[]>
  content: string
  startIndex: number
  endIndex: number
}> {
  const matches: Array<{
    fullMatch: string
    params: Record<string, string | string[]>
    content: string
    startIndex: number
    endIndex: number
  }> = []
  
  // 匹配整个工具标签
  const toolRegex = new RegExp(`<${toolName}>([\\s\\S]*?)</${toolName}>`, 'g')
  
  let match: RegExpExecArray | null
  while ((match = toolRegex.exec(content)) !== null) {
    const fullMatch = match[0]
    const startIndex = match.index
    const endIndex = startIndex + fullMatch.length
    
    // 解析工具内部内容
    const innerContent = match[1]
    const { params, toolContent } = parseToolContent(innerContent, toolName)
    
    matches.push({
      fullMatch,
      params,
      content: toolContent,
      startIndex,
      endIndex
    })
  }
  
  return matches
}

/**
 * 解析工具内部内容（新格式）
 */
function parseToolContent(innerContent: string, toolName: string): {
  params: Record<string, string | string[]>
  toolContent: string
} {
  const config = getToolConfig(toolName)
  const params: Record<string, string | string[]> = {}
  let toolContent = ''
  
  if (!config) {
    return { params, toolContent: innerContent }
  }
  
  // 获取所有可能的参数名称
  const allParams = [...config.requiredParams, ...config.optionalParams]
  
  // 解析每个参数
  for (const paramName of allParams) {
    // 检查是否是数组型参数
    if (config.arrayParams?.includes(paramName)) {
      // 解析数组型参数
      const arrayRegex = new RegExp(`<${paramName}>([\\s\\S]*?)</${paramName}>`, 'g')
      const arrayElements: string[] = []
      let arrayMatch: RegExpExecArray | null
      
      while ((arrayMatch = arrayRegex.exec(innerContent)) !== null) {
        const arrayContent = arrayMatch[1].trim()
        if (arrayContent) {
          // 解析数组内部的元素
          const elementRegex = new RegExp(`<${config.arrayElementName}>([\\s\\S]*?)</${config.arrayElementName}>`, 'g')
          let elementMatch: RegExpExecArray | null
          
          while ((elementMatch = elementRegex.exec(arrayContent)) !== null) {
            const elementValue = elementMatch[1].trim()
            if (elementValue) {
              arrayElements.push(elementValue)
            }
          }
        }
      }
      
      if (arrayElements.length > 0) {
        params[paramName] = arrayElements
      }
    } else {
      // 解析普通参数
      const paramRegex = new RegExp(`<${paramName}>([\\s\\S]*?)</${paramName}>`, 'i')
      const paramMatch = innerContent.match(paramRegex)
      
      if (paramMatch) {
        const paramValue = paramMatch[1].trim()
        if (paramValue) {
          params[paramName] = paramValue
        }
      }
    }
  }
  
  // 提取工具内容（去除已解析的参数标签后的剩余内容）
  toolContent = innerContent
  for (const paramName of allParams) {
    if (config.arrayParams?.includes(paramName)) {
      const arrayRegex = new RegExp(`<${paramName}>[\\s\\S]*?</${paramName}>`, 'g')
      toolContent = toolContent.replace(arrayRegex, '')
    } else {
      const paramRegex = new RegExp(`<${paramName}>[\\s\\S]*?</${paramName}>`, 'gi')
      toolContent = toolContent.replace(paramRegex, '')
    }
  }
  
  toolContent = toolContent.trim()
  
  return { params, toolContent }
}

/**
 * 提取工具标签信息（新格式）
 * @param content 原始消息内容
 * @returns 工具标签数组
 */
export function extractToolTags(content: string): ToolTag[] {
  const toolTags: ToolTag[] = []
  const processedRanges: Array<{ start: number; end: number; toolName: string; match: any }> = []
  
  // 获取所有支持的工具
  const supportedTools = Object.keys(TOOL_CONFIGS)
  
  // 为每个工具单独解析
  for (const toolName of supportedTools) {
    const toolMatches = parseToolByName(content, toolName)
    
    for (const match of toolMatches) {
      // 检查是否与其他工具匹配冲突
      const hasConflict = processedRanges.some(range =>
        (match.startIndex >= range.start && match.startIndex < range.end) ||
        (match.endIndex > range.start && match.endIndex <= range.end)
      )
      
      if (hasConflict) {
        continue // 跳过冲突的匹配
      }
      
      processedRanges.push({
        start: match.startIndex,
        end: match.endIndex,
        toolName,
        match
      })
    }
  }
  
  // 按位置排序
  processedRanges.sort((a, b) => a.start - b.start)
  
  // 构建 ToolTag 数组
  for (const range of processedRanges) {
    const validationErrors = validateToolTag(range.toolName, range.match.params, range.match.content)
    
    toolTags.push({
      name: range.toolName,
      params: range.match.params,
      content: range.match.content,
      startIndex: range.start,
      endIndex: range.end,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined
    })
  }
  
  return toolTags
}