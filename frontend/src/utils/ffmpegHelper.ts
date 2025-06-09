import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'
import type { FFmpegProgress, VideoMetadata } from '@/types/video'

let ffmpeg: FFmpeg | null = null

export const initFFmpeg = async (): Promise<FFmpeg> => {
  if (ffmpeg) return ffmpeg

  ffmpeg = new FFmpeg()
  
  // Load FFmpeg WASM
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
  
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  })

  return ffmpeg
}

export const getVideoMetadata = async (file: File): Promise<VideoMetadata> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    
    video.onloadedmetadata = () => {
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight
      })
      URL.revokeObjectURL(video.src)
    }
    
    video.onerror = () => {
      reject(new Error('Failed to load video metadata'))
      URL.revokeObjectURL(video.src)
    }
    
    video.src = URL.createObjectURL(file)
  })
}

export const extractVideoFrame = async (
  file: File,
  timeInSeconds: number
): Promise<Blob> => {
  const ffmpegInstance = await initFFmpeg()
  
  // Write input file
  const inputName = 'input.mp4'
  const outputName = 'frame.png'
  
  await ffmpegInstance.writeFile(inputName, new Uint8Array(await file.arrayBuffer()))
  
  // Extract frame at specific time
  await ffmpegInstance.exec([
    '-i', inputName,
    '-ss', timeInSeconds.toString(),
    '-vframes', '1',
    '-f', 'image2',
    outputName
  ])
  
  // Read output
  const data = await ffmpegInstance.readFile(outputName)
  
  // Clean up
  await ffmpegInstance.deleteFile(inputName)
  await ffmpegInstance.deleteFile(outputName)
  
  return new Blob([data], { type: 'image/png' })
}

// 创建视频元素的工具函数
export const createVideoElement = (file: File): Promise<HTMLVideoElement> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'

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
    video.preload = 'metadata'

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
