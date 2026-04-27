import * as THREE from 'three'

export const DEFAULT_FLOOR_TEXTURE_ID = 'oak-warm'
export const DEFAULT_WALL_TEXTURE_ID = 'linen-soft'

export const FLOOR_TEXTURE_PRESETS = [
  {
    id: 'oak-warm',
    label: 'Warm eiken',
    preview: 'linear-gradient(135deg, #c18a55 0%, #8b5a34 100%)'
  },
  {
    id: 'herringbone-oak',
    label: 'Visgraat hout',
    preview: 'linear-gradient(135deg, #c89461 0 12px, #9a6740 12px 24px)'
  },
  {
    id: 'terrazzo-sand',
    label: 'Terrazzo zand',
    preview: 'linear-gradient(135deg, #e8dccd 0%, #c9b39c 100%)'
  },
  {
    id: 'terracotta-tiles',
    label: 'Terracotta tegels',
    preview: 'repeating-linear-gradient(135deg, #c97b4f 0 18px, #b5653f 18px 36px)'
  },
  {
    id: 'woven-carpet',
    label: 'Zacht tapijt',
    preview: 'linear-gradient(135deg, #d9cabd 0%, #bca08e 100%)'
  }
]

export const WALL_TEXTURE_PRESETS = [
  {
    id: 'linen-soft',
    label: 'Zacht linnen',
    preview: 'linear-gradient(135deg, #f1e7da 0%, #e4d4c0 100%)'
  },
  {
    id: 'vertical-stripes',
    label: 'Verticale strepen',
    preview: 'repeating-linear-gradient(90deg, #f4eadf 0 14px, #e8d6c3 14px 28px)'
  },
  {
    id: 'vintage-floral',
    label: 'Vintage bloemen',
    preview: 'radial-gradient(circle at 25% 30%, #d7ab98 0 6px, transparent 7px), radial-gradient(circle at 70% 60%, #c8a27f 0 5px, transparent 6px), linear-gradient(135deg, #f6ede3 0%, #e6d8c7 100%)'
  },
  {
    id: 'soft-plaster',
    label: 'Zacht stucwerk',
    preview: 'linear-gradient(135deg, #efe5da 0%, #d9ccc0 100%)'
  },
  {
    id: 'paneled-wainscot',
    label: 'Paneelwand',
    preview: 'linear-gradient(180deg, #efe4d5 0 54%, #d9c1a7 54% 100%)'
  }
]

const FLOOR_PRESET_IDS = new Set(FLOOR_TEXTURE_PRESETS.map((preset) => preset.id))
const WALL_PRESET_IDS = new Set(WALL_TEXTURE_PRESETS.map((preset) => preset.id))

function createTextureCanvas(size, draw) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) return null

  draw(context, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}

function createWoodTexture({ base, accent, grain, plankCount = 6, diagonal = false } = {}) {
  return createTextureCanvas(512, (context, size) => {
    context.fillStyle = base
    context.fillRect(0, 0, size, size)

    const plankSpan = size / plankCount
    for (let i = 0; i < plankCount; i++) {
      const x = Math.floor(i * plankSpan)
      context.fillStyle = i % 2 === 0 ? accent : base
      context.fillRect(x, 0, Math.ceil(plankSpan), size)

      context.strokeStyle = 'rgba(70, 41, 22, 0.24)'
      context.lineWidth = 3
      context.beginPath()
      context.moveTo(x + 1, 0)
      context.lineTo(x + 1, size)
      context.stroke()
    }

    context.strokeStyle = grain
    context.lineWidth = 2
    const limit = diagonal ? 10 : 8
    for (let i = 0; i < limit; i++) {
      const y = (i * size) / limit
      context.beginPath()
      if (diagonal) {
        context.moveTo(0, y)
        context.lineTo(size, Math.min(size, y + 24))
      } else {
        context.moveTo(0, y)
        context.lineTo(size, y)
      }
      context.stroke()
    }

    context.fillStyle = 'rgba(28, 18, 10, 0.12)'
    for (let i = 0; i < 1700; i++) {
      context.fillRect(Math.random() * size, Math.random() * size, 1, 1)
    }
  })
}

function createTerrazzoTexture() {
  return createTextureCanvas(512, (context, size) => {
    context.fillStyle = '#e6dccf'
    context.fillRect(0, 0, size, size)

    const speckles = ['#7b846f', '#bb8164', '#f0b98e', '#7c6a5b', '#d9c2b4']
    for (let i = 0; i < 1800; i++) {
      const x = Math.random() * size
      const y = Math.random() * size
      const radius = 1 + Math.random() * 3
      context.fillStyle = speckles[i % speckles.length]
      context.beginPath()
      context.arc(x, y, radius, 0, Math.PI * 2)
      context.fill()
    }

    context.fillStyle = 'rgba(255, 255, 255, 0.12)'
    for (let i = 0; i < 45; i++) {
      const x = Math.random() * size
      const y = Math.random() * size
      context.beginPath()
      context.arc(x, y, 10 + Math.random() * 20, 0, Math.PI * 2)
      context.fill()
    }
  })
}

function createTerracottaTexture() {
  return createTextureCanvas(512, (context, size) => {
    context.fillStyle = '#b96d42'
    context.fillRect(0, 0, size, size)

    const tile = 72
    context.strokeStyle = 'rgba(91, 50, 29, 0.36)'
    context.lineWidth = 2

    for (let y = 0; y <= size; y += tile) {
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(size, y)
      context.stroke()
    }

    for (let x = 0; x <= size; x += tile) {
      context.beginPath()
      context.moveTo(x, 0)
      context.lineTo(x, size)
      context.stroke()
    }

    for (let y = 0; y < size; y += tile) {
      for (let x = 0; x < size; x += tile) {
        context.fillStyle = (x + y) % (tile * 2) === 0 ? 'rgba(247, 198, 164, 0.16)' : 'rgba(83, 45, 24, 0.12)'
        context.fillRect(x + 1, y + 1, tile - 2, tile - 2)
      }
    }
  })
}

function createCarpetTexture() {
  return createTextureCanvas(512, (context, size) => {
    context.fillStyle = '#b79682'
    context.fillRect(0, 0, size, size)

    context.strokeStyle = 'rgba(255, 246, 237, 0.12)'
    context.lineWidth = 1
    for (let y = 0; y < size; y += 6) {
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(size, y)
      context.stroke()
    }
    for (let x = 0; x < size; x += 6) {
      context.beginPath()
      context.moveTo(x, 0)
      context.lineTo(x, size)
      context.stroke()
    }
  })
}

function createPlasterTexture() {
  return createTextureCanvas(512, (context, size) => {
    context.fillStyle = '#e9dfd3'
    context.fillRect(0, 0, size, size)

    context.fillStyle = 'rgba(166, 137, 116, 0.08)'
    for (let i = 0; i < 2200; i++) {
      context.fillRect(Math.random() * size, Math.random() * size, 1, 1)
    }

    context.fillStyle = 'rgba(255, 255, 255, 0.10)'
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * size
      const y = Math.random() * size
      context.beginPath()
      context.arc(x, y, 8 + Math.random() * 18, 0, Math.PI * 2)
      context.fill()
    }
  })
}

function createVerticalStripeWallpaperTexture() {
  return createTextureCanvas(512, (context, size) => {
    context.fillStyle = '#f3ebdf'
    context.fillRect(0, 0, size, size)

    for (let x = 0; x < size; x += 32) {
      context.fillStyle = x % 64 === 0 ? 'rgba(166, 126, 95, 0.10)' : 'rgba(255, 255, 255, 0.05)'
      context.fillRect(x, 0, 32, size)
    }

    context.strokeStyle = 'rgba(126, 93, 67, 0.11)'
    context.lineWidth = 1.25
    for (let y = 18; y < size; y += 36) {
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(size, y)
      context.stroke()
    }
  })
}

function createFloralWallpaperTexture() {
  return createTextureCanvas(512, (context, size) => {
    context.fillStyle = '#f6efe5'
    context.fillRect(0, 0, size, size)

    const blooms = [
      ['#d89f92', '#9f6d63'],
      ['#c6b07e', '#8f7a4d'],
      ['#a9c0ad', '#73907b']
    ]

    for (let y = 32; y < size; y += 96) {
      for (let x = 32; x < size; x += 96) {
        const [petal, center] = blooms[(x + y) % blooms.length]
        context.fillStyle = petal
        context.beginPath()
        context.arc(x, y, 12, 0, Math.PI * 2)
        context.fill()
        context.fillStyle = center
        context.beginPath()
        context.arc(x, y, 5, 0, Math.PI * 2)
        context.fill()

        context.strokeStyle = 'rgba(103, 77, 63, 0.16)'
        context.lineWidth = 1.5
        context.beginPath()
        context.moveTo(x - 18, y)
        context.lineTo(x + 18, y)
        context.moveTo(x, y - 18)
        context.lineTo(x, y + 18)
        context.stroke()
      }
    }
  })
}

function createWainscotTexture() {
  return createTextureCanvas(512, (context, size) => {
    context.fillStyle = '#f0e5d6'
    context.fillRect(0, 0, size, size)

    context.fillStyle = '#d1b79c'
    context.fillRect(0, size * 0.55, size, size * 0.45)

    context.strokeStyle = 'rgba(104, 76, 52, 0.20)'
    context.lineWidth = 3
    for (let x = 0; x <= size; x += 128) {
      context.beginPath()
      context.moveTo(x, size * 0.55)
      context.lineTo(x, size)
      context.stroke()
    }

    context.strokeStyle = 'rgba(104, 76, 52, 0.14)'
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(0, size * 0.55)
    context.lineTo(size, size * 0.55)
    context.stroke()
  })
}

export function normalizeFloorTextureId(value) {
  const input = String(value || '').trim()
  return FLOOR_PRESET_IDS.has(input) ? input : DEFAULT_FLOOR_TEXTURE_ID
}

export function normalizeWallTextureId(value) {
  const input = String(value || '').trim()
  return WALL_PRESET_IDS.has(input) ? input : DEFAULT_WALL_TEXTURE_ID
}

export function createFloorTexture(textureId = DEFAULT_FLOOR_TEXTURE_ID) {
  const id = normalizeFloorTextureId(textureId)

  if (id === 'herringbone-oak') {
    return createWoodTexture({ base: '#a56d43', accent: '#c7925e', grain: 'rgba(76, 46, 26, 0.22)', plankCount: 8, diagonal: true })
  }

  if (id === 'terrazzo-sand') {
    return createTerrazzoTexture()
  }

  if (id === 'terracotta-tiles') {
    return createTerracottaTexture()
  }

  if (id === 'woven-carpet') {
    return createCarpetTexture()
  }

  return createWoodTexture({ base: '#9f6f42', accent: '#b57a4c', grain: 'rgba(75, 42, 18, 0.18)', plankCount: 6 })
}

export function createWallTexture(textureId = DEFAULT_WALL_TEXTURE_ID) {
  const id = normalizeWallTextureId(textureId)

  if (id === 'vertical-stripes') {
    return createVerticalStripeWallpaperTexture()
  }

  if (id === 'vintage-floral') {
    return createFloralWallpaperTexture()
  }

  if (id === 'soft-plaster') {
    return createPlasterTexture()
  }

  if (id === 'paneled-wainscot') {
    return createWainscotTexture()
  }

  return createPlasterTexture()
}