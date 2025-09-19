export interface ChatMessage {
  id: string
  type: 'user' | 'ai'
  content: string
  timestamp: string
}