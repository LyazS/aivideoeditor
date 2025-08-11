from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse, Response
from fastapi.middleware.cors import CORSMiddleware
import os
import asyncio
import time
from pathlib import Path
from urllib.parse import unquote, quote

app = FastAPI(title="AI Video Editor Backend", version="1.0.0")
print("AI Video Editor Backend is running")
# 添加CORS中间件以支持前端跨域请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生产环境中应该限制为特定域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 文件存储路径占位符 - 你可以修改这个路径
MEDIA_FILES_PATH = "E:/Downloads"  # 修改为你想要的路径

# 网速限制配置（字节/秒）
DOWNLOAD_SPEED_LIMIT = 10240 // 8 * 1024  # 1MB/s，可以调整这个值来模拟不同网速
CHUNK_SIZE = 8192  # 8KB 每个数据块


def _get_media_type(file_extension: str) -> str:
    """
    根据文件后缀判断媒体类型

    Args:
        file_extension: 文件后缀（小写）

    Returns:
        媒体类型字符串
    """
    video_extensions = {
        ".mp4",
        ".avi",
        ".mov",
        ".mkv",
        ".wmv",
        ".flv",
        ".webm",
        ".m4v",
        ".3gp",
    }
    audio_extensions = {".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a", ".wma"}
    image_extensions = {
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".bmp",
        ".webp",
        ".svg",
        ".tiff",
    }

    if file_extension in video_extensions:
        return "video"
    elif file_extension in audio_extensions:
        return "audio"
    elif file_extension in image_extensions:
        return "image"
    else:
        return "unknown"


def _get_mime_type(file_extension: str) -> str:
    """
    根据文件后缀获取MIME类型

    Args:
        file_extension: 文件后缀（小写）

    Returns:
        MIME类型字符串
    """
    mime_types = {
        # 视频格式
        ".mp4": "video/mp4",
        ".avi": "video/avi",
        ".mov": "video/quicktime",
        ".mkv": "video/x-matroska",
        ".wmv": "video/x-ms-wmv",
        ".flv": "video/x-flv",
        ".webm": "video/webm",
        ".m4v": "video/mp4",
        ".3gp": "video/3gpp",
        # 音频格式
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".aac": "audio/aac",
        ".flac": "audio/flac",
        ".ogg": "audio/ogg",
        ".m4a": "audio/mp4",
        ".wma": "audio/x-ms-wma",
        # 图片格式
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".bmp": "image/bmp",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".tiff": "image/tiff",
    }

    return mime_types.get(file_extension, "application/octet-stream")


@app.get("/")
async def root():
    return {"message": "AI Video Editor Backend is running"}


@app.get("/config/download-speed")
async def get_download_speed():
    """获取当前下载速度限制"""
    return {
        "speed_limit_bytes_per_second": DOWNLOAD_SPEED_LIMIT,
        "speed_limit_mbps": round(DOWNLOAD_SPEED_LIMIT / 1024 / 1024, 2),
        "chunk_size": CHUNK_SIZE,
    }


@app.post("/config/download-speed/{speed_mbps}")
async def set_download_speed(speed_mbps: float):
    """设置下载速度限制（MB/s）"""
    global DOWNLOAD_SPEED_LIMIT

    if speed_mbps <= 0:
        raise HTTPException(status_code=400, detail="Speed must be greater than 0")

    if speed_mbps > 100:  # 限制最大100MB/s
        raise HTTPException(status_code=400, detail="Speed cannot exceed 100 MB/s")

    DOWNLOAD_SPEED_LIMIT = int(speed_mbps * 1024 * 1024)

    print(
        f"Download speed limit updated to {speed_mbps} MB/s ({DOWNLOAD_SPEED_LIMIT} bytes/s)"
    )

    return {
        "message": f"Download speed limit set to {speed_mbps} MB/s",
        "speed_limit_bytes_per_second": DOWNLOAD_SPEED_LIMIT,
        "speed_limit_mbps": speed_mbps,
    }


async def _generate_file_stream(file_path: Path):
    """
    生成带网速限制的文件流

    Args:
        file_path: 文件路径

    Yields:
        文件数据块
    """
    with open(file_path, "rb") as file:
        start_time = time.time()
        bytes_sent = 0

        while True:
            chunk = file.read(CHUNK_SIZE)
            if not chunk:
                break

            # 计算应该等待的时间来限制网速
            bytes_sent += len(chunk)
            elapsed_time = time.time() - start_time
            expected_time = bytes_sent / DOWNLOAD_SPEED_LIMIT

            if expected_time > elapsed_time:
                await asyncio.sleep(expected_time - elapsed_time)

            yield chunk


async def _generate_error_file_stream(file_path: Path):
    """
    生成带网速限制的文件流，但在传输过程中故意断开连接以模拟错误场景

    Args:
        file_path: 文件路径

    Yields:
        文件数据块，但在传输到一半时会引发异常
    """
    with open(file_path, "rb") as file:
        start_time = time.time()
        bytes_sent = 0
        
        # 获取文件总大小，以便在传输到一半时断开连接
        file_size = file_path.stat().st_size
        half_size = file_size // 2
        
        while True:
            chunk = file.read(CHUNK_SIZE)
            if not chunk:
                break

            # 计算应该等待的时间来限制网速
            bytes_sent += len(chunk)
            elapsed_time = time.time() - start_time
            expected_time = bytes_sent / DOWNLOAD_SPEED_LIMIT

            if expected_time > elapsed_time:
                await asyncio.sleep(expected_time - elapsed_time)

            # 检查是否已经传输了一半的数据
            if bytes_sent >= half_size:
                # 在传输到一半时故意断开连接
                print(f"模拟错误：在传输到一半时断开连接（已发送 {bytes_sent}/{file_size} 字节）")
                raise ConnectionError("模拟的连接错误：传输过程中断开")

            yield chunk


@app.head("/media/{file_name:path}")
async def head_media_file(file_name: str):
    """
    获取媒体文件的头部信息（不返回文件内容）

    Args:
        file_name: 请求的文件名（支持URL编码的中文文件名）

    Returns:
        响应头或错误信息
    """
    # URL解码文件名以支持中文文件名
    print(f"Received HEAD request for file: {file_name}")
    decoded_file_name = unquote(file_name)

    # 构建完整的文件路径
    file_path = Path(MEDIA_FILES_PATH) / decoded_file_name

    # 检查文件是否存在
    if not file_path.exists():
        raise HTTPException(
            status_code=404, detail=f"File '{decoded_file_name}' not found"
        )

    # 检查是否是文件（不是目录）
    if not file_path.is_file():
        raise HTTPException(
            status_code=400, detail=f"'{decoded_file_name}' is not a file"
        )

    # 获取文件的MIME类型和大小
    file_extension = file_path.suffix.lower()
    mime_type = _get_mime_type(file_extension)
    file_size = file_path.stat().st_size

    print(
        f"HEAD request for file: {decoded_file_name} ({file_size} bytes)"
    )

    # 处理中文文件名的编码问题
    # 使用 RFC 5987 标准的 filename* 参数来支持 UTF-8 编码的文件名
    encoded_filename = quote(file_path.name.encode("utf-8"))

    # 返回空响应体，但包含相同的头部信息
    return Response(
        media_type=mime_type,
        headers={
            "Content-Length": str(file_size),
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
            "Accept-Ranges": "bytes",
        },
    )


@app.get("/media/{file_name:path}")
async def get_media_file(file_name: str):
    """
    获取媒体文件（带网速限制）

    Args:
        file_name: 请求的文件名（支持URL编码的中文文件名）

    Returns:
        流式文件响应或错误信息
    """
    # URL解码文件名以支持中文文件名
    print(f"Received request for file: {file_name}")
    decoded_file_name = unquote(file_name)

    # 构建完整的文件路径
    file_path = Path(MEDIA_FILES_PATH) / decoded_file_name

    # 检查文件是否存在
    if not file_path.exists():
        raise HTTPException(
            status_code=404, detail=f"File '{decoded_file_name}' not found"
        )

    # 检查是否是文件（不是目录）
    if not file_path.is_file():
        raise HTTPException(
            status_code=400, detail=f"'{decoded_file_name}' is not a file"
        )

    # 获取文件的MIME类型和大小
    file_extension = file_path.suffix.lower()
    mime_type = _get_mime_type(file_extension)
    file_size = file_path.stat().st_size

    print(
        f"Serving file: {decoded_file_name} ({file_size} bytes) at {DOWNLOAD_SPEED_LIMIT/1024/1024:.1f} MB/s"
    )

    # 处理中文文件名的编码问题
    # 使用 RFC 5987 标准的 filename* 参数来支持 UTF-8 编码的文件名
    encoded_filename = quote(file_path.name.encode("utf-8"))

    # 返回流式响应
    return StreamingResponse(
        _generate_file_stream(file_path),
        media_type=mime_type,
        headers={
            "Content-Length": str(file_size),
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
            "Accept-Ranges": "bytes",
        },
    )


@app.get("/errormedia/{file_name:path}")
async def get_error_media_file(file_name: str):
    """
    获取媒体文件（带网速限制），但在传输过程中故意断开连接以模拟错误场景

    Args:
        file_name: 请求的文件名（支持URL编码的中文文件名）

    Returns:
        流式文件响应或错误信息
    """
    # URL解码文件名以支持中文文件名
    print(f"Received ERROR request for file: {file_name}")
    decoded_file_name = unquote(file_name)

    # 构建完整的文件路径
    file_path = Path(MEDIA_FILES_PATH) / decoded_file_name

    # 检查文件是否存在
    if not file_path.exists():
        raise HTTPException(
            status_code=404, detail=f"File '{decoded_file_name}' not found"
        )

    # 检查是否是文件（不是目录）
    if not file_path.is_file():
        raise HTTPException(
            status_code=400, detail=f"'{decoded_file_name}' is not a file"
        )

    # 获取文件的MIME类型和大小
    file_extension = file_path.suffix.lower()
    mime_type = _get_mime_type(file_extension)
    file_size = file_path.stat().st_size

    print(
        f"Serving file with ERROR simulation: {decoded_file_name} ({file_size} bytes) at {DOWNLOAD_SPEED_LIMIT/1024/1024:.1f} MB/s"
    )

    # 处理中文文件名的编码问题
    # 使用 RFC 5987 标准的 filename* 参数来支持 UTF-8 编码的文件名
    encoded_filename = quote(file_path.name.encode("utf-8"))

    # 返回流式响应，使用错误模拟的文件流生成器
    return StreamingResponse(
        _generate_error_file_stream(file_path),
        media_type=mime_type,
        headers={
            "Content-Length": str(file_size),
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
            "Accept-Ranges": "bytes",
        },
    )


@app.get("/media")
async def list_media_files():
    """
    列出所有可用的媒体文件

    Returns:
        文件列表
    """
    # 支持的媒体文件后缀
    SUPPORTED_EXTENSIONS = {
        # 视频格式
        ".mp4",
        ".avi",
        ".mov",
        ".mkv",
        ".wmv",
        ".flv",
        ".webm",
        ".m4v",
        ".3gp",
        # 音频格式
        ".mp3",
        ".wav",
        ".aac",
        ".flac",
        ".ogg",
        ".m4a",
        ".wma",
        # 图片格式
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".bmp",
        ".webp",
        ".svg",
        ".tiff",
    }

    media_path = Path(MEDIA_FILES_PATH)

    # 如果目录不存在，创建它
    if not media_path.exists():
        media_path.mkdir(parents=True, exist_ok=True)
        return {"files": [], "message": f"Created directory: {MEDIA_FILES_PATH}"}

    # 获取所有媒体文件
    files = []
    for file_path in media_path.iterdir():
        if file_path.is_file():
            # 检查文件后缀是否为支持的媒体格式
            if file_path.suffix.lower() in SUPPORTED_EXTENSIONS:
                files.append(
                    {
                        "name": file_path.name,  # 保持原始文件名
                        "size": file_path.stat().st_size,
                        "url": f"/media/{quote(file_path.name)}",  # URL编码文件名
                        "type": _get_media_type(file_path.suffix.lower()),
                    }
                )

    return {"files": files, "total": len(files)}


if __name__ == "__main__":
    import uvicorn

    # 确保媒体文件目录存在
    Path(MEDIA_FILES_PATH).mkdir(parents=True, exist_ok=True)

    uvicorn.run(app, host="0.0.0.0", port=8900)
