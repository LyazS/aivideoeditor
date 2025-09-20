import asyncio
import os
from loguru import logger
from typing import List, AsyncGenerator, Optional, Dict, Any
from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam, ChatCompletionMessage
from openai import (
    APIError,
    APIConnectionError,
    RateLimitError,
    AuthenticationError,
    BadRequestError,
    ConflictError,
    InternalServerError,
    NotFoundError,
    PermissionDeniedError,
    UnprocessableEntityError
)
from pydantic import BaseModel

class TokenUsage(BaseModel):
    """Token 使用统计"""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0

class AIService:
    def __init__(self):
        # 从环境变量获取配置
        api_key = os.getenv("OPENAI_API_KEY")
        base_url = os.getenv("OPENAI_BASE_URL")
        model = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
        
        if not api_key:
            logger.warning("未找到 OPENAI_API_KEY 环境变量，请检查 .env 文件配置")
        
        # 配置 AsyncOpenAI 客户端
        client_config = {}
        if api_key:
            client_config["api_key"] = api_key
        if base_url:
            client_config["base_url"] = base_url
            
        self.client = AsyncOpenAI(**client_config)
        self.model = model
        self._last_usage: Optional[TokenUsage] = None
    
    def _handle_authentication_error(self, error: AuthenticationError) -> str:
        """处理认证错误"""
        logger.error(f"OpenAI API 认证错误: {error}")
        return "[OpenAI API 错误: API 密钥验证失败，请检查您的 API 密钥设置]"
    
    def _handle_rate_limit_error(self, error: RateLimitError) -> str:
        """处理频率限制错误"""
        logger.warning(f"OpenAI API 频率限制: {error}")
        return "[OpenAI API 错误: 请求频率过高，请稍后再试]"
    
    def _handle_connection_error(self, error: APIConnectionError) -> str:
        """处理连接错误"""
        logger.error(f"OpenAI API 连接错误: {error}")
        return "[OpenAI API 错误: 无法连接到 OpenAI 服务，请检查网络连接]"
    
    def _handle_timeout_error(self, error: asyncio.TimeoutError) -> str:
        """处理超时错误"""
        logger.warning(f"OpenAI API 请求超时: {error}")
        return "[OpenAI API 错误: 请求超时，请稍后重试]"
    
    def _handle_bad_request_error(self, error: BadRequestError) -> str:
        """处理请求格式错误"""
        logger.error(f"OpenAI API 请求格式错误: {error}")
        return "[OpenAI API 错误: 请求格式错误，请检查输入内容]"
    
    def _handle_server_error(self, error: InternalServerError) -> str:
        """处理服务器内部错误"""
        logger.error(f"OpenAI API 服务器内部错误: {error}")
        return "[OpenAI API 错误: OpenAI 服务器内部错误，请稍后重试]"
    
    def _handle_not_found_error(self, error: NotFoundError) -> str:
        """处理资源不存在错误"""
        logger.error(f"OpenAI API 资源不存在: {error}")
        return "[OpenAI API 错误: 请求的资源不存在]"
    
    def _handle_permission_error(self, error: PermissionDeniedError) -> str:
        """处理权限错误"""
        logger.error(f"OpenAI API 权限不足: {error}")
        return "[OpenAI API 错误: 权限不足，请检查 API 密钥权限]"
    
    def _handle_unprocessable_error(self, error: UnprocessableEntityError) -> str:
        """处理无法处理的实体错误"""
        logger.error(f"OpenAI API 无法处理的实体: {error}")
        return "[OpenAI API 错误: 请求内容无法处理，请检查输入格式]"
    
    def _get_message_content_length(self, message: ChatCompletionMessageParam) -> int:
        """安全地获取消息内容长度"""
        content = message.get("content", "")
        if isinstance(content, str):
            return len(content)
        else:
            # 对于复杂内容类型，估算长度
            return 50  # 默认估算值
    
    async def stream_generate(self, history: List[ChatCompletionMessageParam]) -> AsyncGenerator[str, None]:
        """使用 OpenAI API 生成流式响应"""
        # 历史消息已经是正确的参数格式，直接使用
        messages: List[ChatCompletionMessageParam] = history
        
        try:
            # 调用 OpenAI API 获取流式响应
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                stream=True,
                temperature=0.7,
                stream_options={"include_usage": True}  # 启用 usage 统计
            )
            
            # 重置上次的 usage 统计
            self._last_usage = TokenUsage()
            
            # 流式输出响应
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content
                
                # 收集 usage 统计信息（通常在最后一个 chunk 中）
                if chunk.usage:
                    self._last_usage.prompt_tokens = chunk.usage.prompt_tokens or 0
                    self._last_usage.completion_tokens = chunk.usage.completion_tokens or 0
                    self._last_usage.total_tokens = chunk.usage.total_tokens or 0
                    
        except AuthenticationError as e:
            error_message = self._handle_authentication_error(e)
            logger.error(f"流式生成失败: {error_message}")
            yield f"{error_message}\n"
            self._last_usage = TokenUsage()
            
        except RateLimitError as e:
            error_message = self._handle_rate_limit_error(e)
            logger.error(f"流式生成失败: {error_message}")
            yield f"{error_message}\n"
            self._last_usage = TokenUsage()
            
        except APIConnectionError as e:
            error_message = self._handle_connection_error(e)
            logger.error(f"流式生成失败: {error_message}")
            yield f"{error_message}\n"
            self._last_usage = TokenUsage()
            
        except asyncio.TimeoutError as e:
            error_message = self._handle_timeout_error(e)
            logger.error(f"流式生成失败: {error_message}")
            yield f"{error_message}\n"
            self._last_usage = TokenUsage()
            
        except BadRequestError as e:
            error_message = self._handle_bad_request_error(e)
            logger.error(f"流式生成失败: {error_message}")
            yield f"{error_message}\n"
            self._last_usage = TokenUsage()
            
        except InternalServerError as e:
            error_message = self._handle_server_error(e)
            logger.error(f"流式生成失败: {error_message}")
            yield f"{error_message}\n"
            self._last_usage = TokenUsage()
            
        except NotFoundError as e:
            error_message = self._handle_not_found_error(e)
            logger.error(f"流式生成失败: {error_message}")
            yield f"{error_message}\n"
            self._last_usage = TokenUsage()
            
        except PermissionDeniedError as e:
            error_message = self._handle_permission_error(e)
            logger.error(f"流式生成失败: {error_message}")
            yield f"{error_message}\n"
            self._last_usage = TokenUsage()
            
        except UnprocessableEntityError as e:
            error_message = self._handle_unprocessable_error(e)
            logger.error(f"流式生成失败: {error_message}")
            yield f"{error_message}\n"
            self._last_usage = TokenUsage()
            
        except Exception as e:
            # 处理其他未预期的错误
            logger.error(f"OpenAI API 未知错误: {type(e).__name__}: {str(e)}")
            error_message = "[OpenAI API 错误: 发生未知错误，请稍后重试]"
            yield f"{error_message}\n"
            self._last_usage = TokenUsage()
    
    def get_last_token_usage(self) -> Optional[TokenUsage]:
        """获取最后一次请求的 token 使用统计"""
        return self._last_usage
    
    async def generate_with_usage(self, history: List[ChatCompletionMessageParam]) -> tuple[str, TokenUsage]:
        """生成响应并返回完整的响应内容和 token 使用统计"""
        full_response = ""
        async for chunk in self.stream_generate(history):
            full_response += chunk
        
        # 确保有 usage 统计（如果没有从流中获取到，则进行估算）
        if self._last_usage is None or self._last_usage.total_tokens == 0:
            self._last_usage = TokenUsage(
                prompt_tokens=sum(self._get_message_content_length(msg) for msg in history) // 4,
                completion_tokens=len(full_response) // 4,
                total_tokens=sum(self._get_message_content_length(msg) for msg in history) // 4 + len(full_response) // 4
            )
        
        return full_response, self._last_usage
    
# 创建全局实例
AI_SERVICE = AIService()