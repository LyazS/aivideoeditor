import uuid
from datetime import datetime
from typing import Dict, Optional, List
from loguru import logger
from openai.types.chat import ChatCompletionMessageParam, ChatCompletionUserMessageParam, ChatCompletionAssistantMessageParam
from models.models import ChatSession

# 内存存储
sessions: Dict[str, ChatSession] = {}
logger.info("会话管理器初始化完成")

class SessionManager:
    def __init__(self):
        self.sessions: Dict[str, ChatSession] = {}
    
    def create_session(self) -> ChatSession:
        session_id = f"chat_{uuid.uuid4()}"
        logger.debug(f"创建新会话: {session_id}")
        
        session = ChatSession(
            session_id=session_id,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        self.sessions[session_id] = session
        logger.success(f"会话创建成功: {session_id}")
        return session
    
    def get_session(self, session_id: str) -> Optional[ChatSession]:
        session = self.sessions.get(session_id)
        if session:
            logger.debug(f"找到会话: {session_id}")
        else:
            logger.warning(f"会话未找到: {session_id}")
        return session
    
    def update_session(self, session_id: str):
        if session_id in self.sessions:
            self.sessions[session_id].updated_at = datetime.now()
            logger.debug(f"会话更新时间: {session_id}")
        else:
            logger.warning(f"尝试更新不存在的会话: {session_id}")
    
    def save_message(self, session_id: str, role: str, content: str):
        """保存消息到指定会话"""
        logger.debug(f"保存消息到会话: {session_id}, 角色: {role}, 内容长度: {len(content)}")
        
        session = self.get_session(session_id)
        if session:
            # 根据角色创建正确的消息类型
            if role == "user":
                message: ChatCompletionMessageParam = ChatCompletionUserMessageParam(
                    role="user",
                    content=content
                )
            elif role == "assistant":
                message: ChatCompletionMessageParam = ChatCompletionAssistantMessageParam(
                    role="assistant",
                    content=content
                )
            elif role == "system":
                from openai.types.chat import ChatCompletionSystemMessageParam
                message: ChatCompletionMessageParam = ChatCompletionSystemMessageParam(
                    role="system",
                    content=content
                )
            else:
                # 对于其他角色，使用工具消息类型作为后备
                from openai.types.chat import ChatCompletionToolMessageParam
                message: ChatCompletionMessageParam = ChatCompletionToolMessageParam(
                    role="tool",
                    content=content,
                    tool_call_id=f"unknown_{role}"  # 工具消息需要 tool_call_id
                )
            
            session.messages.append(message)
            self.update_session(session_id)
            logger.success(f"消息保存成功: {session_id}, 当前消息总数: {len(session.messages)}")
        else:
            logger.error(f"尝试保存消息到不存在的会话: {session_id}")
    
    def get_session_history(self, session_id: str) -> List[ChatCompletionMessageParam]:
        """获取指定会话的消息历史"""
        logger.debug(f"获取会话历史: {session_id}")
        
        session = self.get_session(session_id)
        if session:
            history_count = len(session.messages)
            logger.info(f"成功获取会话历史: {session_id}, 消息数量: {history_count}")
            return session.messages
        
        logger.warning(f"获取会话历史失败，会话不存在: {session_id}")
        return []

# 创建全局实例
SESSION_MANAGER = SessionManager()