import os
from fastapi import FastAPI
from utils.logger_config import configure_logging
from loguru import logger
from routers.routers import router

# 尝试加载 .env 文件
try:
    from dotenv import load_dotenv
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(os.path.join(backend_dir, '.env'))
    print("成功加载 .env 文件")
except ImportError:
    print("提示: 未安装 python-dotenv 包，无法自动加载 .env 文件")

# 配置日志系统 - 只在终端输出，不保存到本地文件
configure_logging(
    log_level="INFO"
)

# 使用默认的 logger

logger.info("启动 AI Chat Backend 服务")

app = FastAPI(title="AI Chat Backend", version="1.0.0")

# 注册路由
app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    logger.info("开始运行 Uvicorn 服务器")
    uvicorn.run(app, host="0.0.0.0", port=8000)