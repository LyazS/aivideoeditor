# AI聊天后端

基于FastAPI的流式AI聊天后端服务，支持会话管理和纯文本流式响应。

## 功能特性

- ✅ 会话创建与管理
- ✅ 消息历史记录
- ✅ 纯文本流式响应
- ✅ 异步处理
- ✅ 内存存储（开发环境）

## API端点

### 1. 创建会话
```http
POST /api/chat/create-session
```
响应：
```json
{
    "session_id": "chat_7f8a9b2c_3d4e_5f6g_7h8i_9j0k1l2m3n4o",
    "created_at": "2025-01-20T12:15:30Z"
}
```

### 2. 发送消息（流式响应）
```http
POST /api/chat/send-message
Content-Type: application/json

{
    "session_id": "chat_7f8a9b2c_3d4e_5f6g_7h8i_9j0k1l2m3n4o",
    "message": "用户输入的消息内容"
}
```
响应：`StreamingResponse` (text/plain) - 纯文本流式传输

### 3. 获取会话历史
```http
GET /api/chat/session/{session_id}/history
```
响应：
```json
{
    "session_id": "chat_7f8a9b2c_3d4e_5f6g_7h8i_9j0k1l2m3n4o",
    "messages": [
        {
            "role": "user",
            "content": "你好",
            "timestamp": "2025-01-20T12:15:35Z"
        }
    ]
}
```

### 4. 健康检查
```http
GET /health
```

## 快速开始

### 安装依赖
```bash
pip install -r requirements.txt
```

### 启动服务
```bash
python main.py
```
或使用uvicorn：
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 测试
运行测试脚本：
```bash
python test_chat.py
```

## 配置参数

- 会话过期时间：24小时
- 最大消息长度：4000字符
- 最大历史消息数：10条
- 流式分块大小：1024字节
- 流式响应超时：30秒

## 错误处理

- `400 Bad Request`: 请求参数错误
- `404 Not Found`: 会话不存在
- `413 Payload Too Large`: 消息过长
- `500 Internal Server Error`: AI服务异常

## 开发说明

当前版本使用内存存储，适合开发测试环境。生产环境建议使用Redis或数据库存储。

## 测试示例

测试脚本会自动执行以下测试：
1. 健康检查
2. 创建会话
3. 多轮对话测试
4. 获取会话历史