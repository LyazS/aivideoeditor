from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import os
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

def _get_media_type(file_extension: str) -> str:
    """
    根据文件后缀判断媒体类型

    Args:
        file_extension: 文件后缀（小写）

    Returns:
        媒体类型字符串
    """
    video_extensions = {'.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm', '.m4v', '.3gp'}
    audio_extensions = {'.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a', '.wma'}
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff'}

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
        '.mp4': 'video/mp4',
        '.avi': 'video/avi',
        '.mov': 'video/quicktime',
        '.mkv': 'video/x-matroska',
        '.wmv': 'video/x-ms-wmv',
        '.flv': 'video/x-flv',
        '.webm': 'video/webm',
        '.m4v': 'video/mp4',
        '.3gp': 'video/3gpp',

        # 音频格式
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.aac': 'audio/aac',
        '.flac': 'audio/flac',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4',
        '.wma': 'audio/x-ms-wma',

        # 图片格式
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.bmp': 'image/bmp',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.tiff': 'image/tiff',
    }

    return mime_types.get(file_extension, 'application/octet-stream')

@app.get("/")
async def root():
    return {"message": "AI Video Editor Backend is running"}

@app.get("/media/{file_name:path}")
async def get_media_file(file_name: str):
    """
    获取媒体文件

    Args:
        file_name: 请求的文件名（支持URL编码的中文文件名）

    Returns:
        文件响应或错误信息
    """
    # URL解码文件名以支持中文文件名
    print(f"Received request for file: {file_name}")
    decoded_file_name = unquote(file_name)

    # 构建完整的文件路径
    file_path = Path(MEDIA_FILES_PATH) / decoded_file_name
    
    # 检查文件是否存在
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File '{decoded_file_name}' not found")
    
    # 检查是否是文件（不是目录）
    if not file_path.is_file():
        raise HTTPException(status_code=400, detail=f"'{decoded_file_name}' is not a file")
    
    # 获取文件的MIME类型
    file_extension = file_path.suffix.lower()
    mime_type = _get_mime_type(file_extension)

    # 返回文件
    # 对于中文文件名，使用原始文件名（不需要特殊编码）
    return FileResponse(
        path=str(file_path),
        filename=file_path.name,  # 使用原始文件名
        media_type=mime_type
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
        '.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm', '.m4v', '.3gp',
        # 音频格式
        '.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a', '.wma',
        # 图片格式
        '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff'
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
                files.append({
                    "name": file_path.name,  # 保持原始文件名
                    "size": file_path.stat().st_size,
                    "url": f"/media/{quote(file_path.name)}",  # URL编码文件名
                    "type": _get_media_type(file_path.suffix.lower())
                })

    return {"files": files, "total": len(files)}

if __name__ == "__main__":
    import uvicorn
    
    # 确保媒体文件目录存在
    Path(MEDIA_FILES_PATH).mkdir(parents=True, exist_ok=True)
    
    uvicorn.run(app, host="0.0.0.0", port=8900)
