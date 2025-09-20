"""
日志配置模块
提供统一的日志配置和管理功能
"""

import sys
from pathlib import Path
from loguru import logger
from typing import Optional

def configure_logging(
    log_level: str = "INFO",
    enable_console: bool = True
) -> None:
    """
    配置日志系统
    
    Args:
        log_level: 日志级别 (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        enable_console: 是否启用控制台输出
    """
    # 移除所有默认处理器
    logger.remove()
    
    # 控制台输出配置
    if enable_console:
        logger.add(
            sys.stdout,
            format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
            level=log_level,
            colorize=True
        )
    
    logger.info(f"日志系统配置完成，级别: {log_level}")

# 直接使用默认的 logger