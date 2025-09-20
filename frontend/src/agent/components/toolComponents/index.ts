import type { Component } from 'vue'
import ToolComponent from './ToolComponent.vue'
import { getToolComponentConfig } from '@/agent/utils/toolConfigs'

export interface ToolComponentProps {
  attributes: Record<string, string>
  content: string
  validationErrors?: string[]
  onExecute?: () => void
}

export interface ToolComponentMapping {
  [key: string]: Component
}

// 定义支持的工具类型
const SUPPORTED_TOOLS = [
  'search_contents',
  'read_content',
  'list_contents',
  'execute_command'
] as const

export type ToolName = typeof SUPPORTED_TOOLS[number]

export const toolComponentMap: ToolComponentMapping = {
  'search_contents': ToolComponent,
  'read_content': ToolComponent,
  'list_contents': ToolComponent,
  'execute_command': ToolComponent
}

export function getToolComponent(toolName: string): Component | null {
  return toolComponentMap[toolName] || null
}

export function isValidToolName(toolName: string): boolean {
  return toolName in toolComponentMap
}

// 重新导出工具配置相关函数，方便组件使用
export { getToolComponentConfig }