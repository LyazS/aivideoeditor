// 视频处理工具函数

// 创建视频元素的工具函数
export const createVideoElement = (file: File): Promise<HTMLVideoElement> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.playsInline = true
    video.preload = 'auto' // 改为自动预加载，提高播放流畅度

    let resolved = false

    const cleanup = () => {
      video.removeEventListener('loadeddata', onLoadedData)
      video.removeEventListener('loadedmetadata', onLoadedMetadata)
      video.removeEventListener('error', onError)
    }

    const onLoadedData = () => {
      if (!resolved && video.readyState >= 2) {
        resolved = true
        cleanup()

        resolve(video)
      }
    }

    const onLoadedMetadata = () => {
      // Metadata loaded
    }

    const onError = (e: Event) => {
      if (!resolved) {
        resolved = true
        cleanup()
        console.error('Video loading error:', e)
        reject(new Error('Failed to load video'))
        URL.revokeObjectURL(video.src)
      }
    }

    video.addEventListener('loadeddata', onLoadedData)
    video.addEventListener('loadedmetadata', onLoadedMetadata)
    video.addEventListener('error', onError)

    video.src = URL.createObjectURL(file)
  })
}

// 从URL创建视频元素的工具函数
export const createVideoElementFromURL = (url: string): Promise<HTMLVideoElement> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.playsInline = true
    video.preload = 'auto' // 改为自动预加载，提高播放流畅度

    let resolved = false

    const cleanup = () => {
      video.removeEventListener('loadeddata', onLoadedData)
      video.removeEventListener('loadedmetadata', onLoadedMetadata)
      video.removeEventListener('error', onError)
    }

    const onLoadedData = () => {
      if (!resolved && video.readyState >= 2) {
        resolved = true
        cleanup()

        resolve(video)
      }
    }

    const onLoadedMetadata = () => {
      // Metadata loaded from URL
    }

    const onError = (e: Event) => {
      if (!resolved) {
        resolved = true
        cleanup()
        console.error('Video loading error from URL:', e, url)
        reject(new Error('Failed to load video from URL'))
      }
    }

    video.addEventListener('loadeddata', onLoadedData)
    video.addEventListener('loadedmetadata', onLoadedMetadata)
    video.addEventListener('error', onError)

    video.src = url
  })
}


