# AI Video Editor Backend

一个简单的FastAPI后端，用于测试网络素材功能。

## 安装依赖

```bash
pip install -r requirements.txt
```

## 运行服务器

```bash
python main.py
```

服务器将在 `http://localhost:8900` 启动。

## API 端点

### 1. 获取媒体文件
- **URL**: `GET /media/{file_name}`
- **描述**: 根据文件名获取媒体文件
- **参数**: 
  - `file_name`: 要获取的文件名
- **示例**: `GET /media/video.mp4`

### 2. 列出所有媒体文件
- **URL**: `GET /media`
- **描述**: 获取所有可用媒体文件的列表（自动过滤非媒体文件）
- **支持的格式**:
  - 视频: mp4, avi, mov, mkv, wmv, flv, webm, m4v, 3gp
  - 音频: mp3, wav, aac, flac, ogg, m4a, wma
  - 图片: jpg, jpeg, png, gif, bmp, webp, svg, tiff
- **返回**: 包含文件信息的JSON数组，每个文件包含name、size、url、type字段

### 3. 健康检查
- **URL**: `GET /`
- **描述**: 检查服务器是否正常运行

## 配置

在 `main.py` 中修改 `MEDIA_FILES_PATH` 变量来指定媒体文件存储路径：

```python
MEDIA_FILES_PATH = "./media_files"  # 修改为你想要的路径
```

## 使用说明

1. 将你的测试媒体文件放在 `MEDIA_FILES_PATH` 指定的目录中
2. 启动服务器
3. 通过 `http://localhost:8900/media/文件名` 访问文件
4. 通过 `http://localhost:8900/media` 查看所有可用文件

## 示例

假设你在 `./media_files` 目录中放了一个 `test.mp4` 文件：

- 访问文件: `http://localhost:8900/media/test.mp4`
- 查看所有文件: `http://localhost:8900/media`
