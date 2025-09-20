from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from openai.types.chat import ChatCompletionMessageParam


class ChatSession(BaseModel):
    """聊天会话模型"""

    session_id: str
    created_at: datetime
    updated_at: datetime
    messages: List[ChatCompletionMessageParam] = []  # 使用正确的 OpenAI 参数类型


# 请求模型
class CreateSessionRequest(BaseModel):
    pass


class SendMessageRequest(BaseModel):
    session_id: str
    message: str


class SessionHistoryResponse(BaseModel):
    session_id: str
    messages: List[ChatCompletionMessageParam]  # 使用正确的 OpenAI 参数类型
