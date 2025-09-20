from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from datetime import datetime
from loguru import logger
from models.models import SendMessageRequest, SessionHistoryResponse
from managers.session_manager import SESSION_MANAGER
from services.ai_service import AI_SERVICE

router = APIRouter()
logger.info("初始化 API 路由")


@router.post("/api/chat/create-session")
async def create_session():
    """创建新的聊天会话"""
    logger.info("收到创建会话请求")
    session = SESSION_MANAGER.create_session()
    logger.success(f"成功创建会话: {session.session_id}")
    return {
        "session_id": session.session_id,
        "created_at": session.created_at.isoformat(),
    }


@router.post("/api/chat/send-message")
async def send_message(request: SendMessageRequest):
    """发送消息并获取AI流式响应"""
    logger.info(f"收到消息请求，会话ID: {request.session_id}")
    logger.debug(f"用户消息内容: {request.message[:100]}...")
    
    session = SESSION_MANAGER.get_session(request.session_id)
    if not session:
        logger.warning(f"会话未找到: {request.session_id}")
        raise HTTPException(status_code=404, detail="Session not found")

    # 保存用户消息
    SESSION_MANAGER.save_message(request.session_id, "user", request.message)
    logger.debug(f"用户消息已保存到会话: {request.session_id}")

    # 获取历史消息
    history = SESSION_MANAGER.get_session_history(request.session_id)
    logger.debug(f"获取历史消息，共 {len(history)} 条")

    async def generate_stream():
        try:
            logger.info(f"开始生成AI响应，会话ID: {request.session_id}")
            full_response = ""
            chunk_count = 0
            
            async for chunk in AI_SERVICE.stream_generate(history):
                yield chunk
                full_response += chunk
                chunk_count += 1
                if chunk_count % 10 == 0:  # 每10个chunk记录一次进度
                    logger.debug(f"已生成 {chunk_count} 个响应块")

            # 保存AI完整响应
            SESSION_MANAGER.save_message(
                request.session_id, "assistant", full_response.strip()
            )
            logger.success(f"AI响应生成完成，会话ID: {request.session_id}，共 {chunk_count} 个块")
            
        except Exception as e:
            logger.error(f"响应生成失败，会话ID: {request.session_id}，错误: {str(e)}")
            yield f"\n[错误: 响应生成失败 - {str(e)}]"

    return StreamingResponse(
        generate_stream(),
        media_type="text/plain",
        headers={"Cache-Control": "no-cache"},
    )


@router.get(
    "/api/chat/session/{session_id}/history", response_model=SessionHistoryResponse
)
async def get_session_history(session_id: str):
    """获取指定会话的消息历史"""
    logger.info(f"收到获取历史消息请求，会话ID: {session_id}")
    
    session = SESSION_MANAGER.get_session(session_id)
    if not session:
        logger.warning(f"获取历史消息时会话未找到: {session_id}")
        raise HTTPException(status_code=404, detail="Session not found")

    history = SESSION_MANAGER.get_session_history(session_id)
    logger.success(f"成功获取历史消息，会话ID: {session_id}，共 {len(history)} 条消息")
    
    return SessionHistoryResponse(
        session_id=session_id, messages=history
    )


@router.get("/")
async def root():
    logger.debug("收到根路径请求")
    return {"message": "AI Chat Backend is running"}


@router.get("/health")
async def health_check():
    logger.debug("收到健康检查请求")
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}
