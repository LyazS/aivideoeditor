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
        console.log('Video element created successfully:', {
          readyState: video.readyState,
          dimensions: { width: video.videoWidth, height: video.videoHeight },
          duration: video.duration
        })
        resolve(video)
      }
    }

    const onLoadedMetadata = () => {
      console.log('Video metadata loaded:', {
        dimensions: { width: video.videoWidth, height: video.videoHeight },
        duration: video.duration
      })
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
    console.log('Created video element for file:', file.name, 'URL:', video.src)
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
        console.log('Video element created from URL successfully:', {
          readyState: video.readyState,
          dimensions: { width: video.videoWidth, height: video.videoHeight },
          duration: video.duration,
          url: url
        })
        resolve(video)
      }
    }

    const onLoadedMetadata = () => {
      console.log('Video metadata loaded from URL:', {
        dimensions: { width: video.videoWidth, height: video.videoHeight },
        duration: video.duration,
        url: url
      })
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
    console.log('Created video element from URL:', url)
  })
}

// 设置视频到指定时间
export const loadVideoAtTime = (video: HTMLVideoElement, time: number): Promise<void> => {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      resolve()
    }
    
    video.addEventListener('seeked', onSeeked)
    video.currentTime = time
  })
}
