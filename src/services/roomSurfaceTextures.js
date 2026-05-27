import * as THREE from 'three'

export const DEFAULT_FLOOR_TEXTURE_ID = 'oak-warm'
export const DEFAULT_WALL_TEXTURE_ID = 'linen-soft'

export const FLOOR_TEXTURE_PRESETS = [
  {
    id: 'oak-warm',
    label: 'Hout',
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
    id: 'concrete-slab',
    label: 'Beton',
    preview: 'linear-gradient(135deg, #d7d3cb 0%, #a9a49a 100%)'
  },
  {
    id: 'checker-tiles',
    label: 'Tegelpatroon',
    preview: 'repeating-linear-gradient(45deg, #f4efe6 0 18px, #2d2a26 18px 36px)'
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
  },
  {
    id: 'paper-bloom',
    label: 'Papierbloesem',
    preview: 'radial-gradient(circle at 24% 28%, #d7b4a6 0 6px, transparent 7px), radial-gradient(circle at 72% 64%, #bea881 0 5px, transparent 6px), linear-gradient(135deg, #f6efe7 0%, #ebdfd4 100%)'
  },
  {
    id: 'chalk-ridge',
    label: 'Krijtstuc',
    preview: 'linear-gradient(135deg, #f1e8dd 0%, #d8cdc2 100%)'
  }
]

const FLOOR_PRESET_IDS = new Set(FLOOR_TEXTURE_PRESETS.map((preset) => preset.id))
const WALL_PRESET_IDS = new Set(WALL_TEXTURE_PRESETS.map((preset) => preset.id))

function toHexColor(value, fallback) {
  const input = String(value || '').trim().toLowerCase()
  return /^#[0-9a-f]{6}$/.test(input) ? input : fallback
}

function getSurfaceTextureDefaults(surface, textureId) {
  if (surface === 'floor') {
    if (textureId === 'herringbone-oak') {
      return { primaryColor: '#a56d43', secondaryColor: '#c7925e' }
    }

    if (textureId === 'terrazzo-sand') {
      return { primaryColor: '#e6dccf', secondaryColor: '#9f8d79' }
    }

    if (textureId === 'concrete-slab') {
      return { primaryColor: '#d9d4ca', secondaryColor: '#9c958a' }
    }

    if (textureId === 'checker-tiles') {
      return { primaryColor: '#f4efe6', secondaryColor: '#2d2a26' }
    }

    if (textureId === 'woven-carpet') {
      return { primaryColor: '#b79682', secondaryColor: '#d7c3b4' }
    }

    return { primaryColor: '#9f6f42', secondaryColor: '#b57a4c' }
  }

  if (textureId === 'vertical-stripes') {
    return { primaryColor: '#f3ebdf', secondaryColor: '#e8d6c3' }
  }

  if (textureId === 'vintage-floral') {
    return { primaryColor: '#f6efe5', secondaryColor: '#d89f92' }
  }

  if (textureId === 'soft-plaster') {
    return { primaryColor: '#e9dfd3', secondaryColor: '#cdb9a9' }
  }

  if (textureId === 'paneled-wainscot') {
    return { primaryColor: '#f0e5d6', secondaryColor: '#d1b79c' }
  }

  if (textureId === 'paper-bloom') {
    return { primaryColor: '#f6efe7', secondaryColor: '#d7b4a6' }
  }

  if (textureId === 'chalk-ridge') {
    return { primaryColor: '#f1e8dd', secondaryColor: '#d8cdc2' }
  }

  return { primaryColor: '#efe3d6', secondaryColor: '#d9ccc0' }
}

export function getFloorTextureDefaults(textureId = DEFAULT_FLOOR_TEXTURE_ID) {
  return getSurfaceTextureDefaults('floor', normalizeFloorTextureId(textureId))
}

export function getWallTextureDefaults(textureId = DEFAULT_WALL_TEXTURE_ID) {
  return getSurfaceTextureDefaults('wall', normalizeWallTextureId(textureId))
}

export function normalizeSurfaceTextureColors(surface, textureId, colors = {}) {
  const normalizedTextureId = surface === 'wall' ? normalizeWallTextureId(textureId) : normalizeFloorTextureId(textureId)
  const defaults = getSurfaceTextureDefaults(surface, normalizedTextureId)
  return {
    primaryColor: toHexColor(colors?.primaryColor, defaults.primaryColor),
    secondaryColor: toHexColor(colors?.secondaryColor, defaults.secondaryColor)
  }
}

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

function createTerrazzoTexture({ base, accent } = {}) {
  return createTextureCanvas(512, (context, size) => {
    context.fillStyle = base
    context.fillRect(0, 0, size, size)

    const speckles = [accent, '#7b846f', '#bb8164', '#f0b98e', '#7c6a5b']
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

function createTerracottaTexture({ base, accent } = {}) {
  return createTextureCanvas(512, (context, size) => {
    context.fillStyle = base
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

    context.strokeStyle = accent
    context.lineWidth = 1
    for (let i = 0; i < 7; i++) {
      const y = (i * size) / 7 + 12
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(size, y)
      context.stroke()
    }
  })
}

function createCarpetTexture({ base, accent } = {}) {
  return createTextureCanvas(512, (context, size) => {
    context.fillStyle = base
    context.fillRect(0, 0, size, size)

    context.strokeStyle = accent
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

function createCheckerTileTexture({ base, accent } = {}) {
  return createTextureCanvas(512, (context, size) => {
    const tile = 64

    for (let y = 0; y < size; y += tile) {
      for (let x = 0; x < size; x += tile) {
        const isDark = ((x / tile) + (y / tile)) % 2 === 1
        context.fillStyle = isDark ? accent : base
        context.fillRect(x, y, tile, tile)
      }
    }

    context.strokeStyle = 'rgba(0, 0, 0, 0.16)'
    context.lineWidth = 2
    for (let x = 0; x <= size; x += tile) {
      context.beginPath()
      context.moveTo(x, 0)
      context.lineTo(x, size)
      context.stroke()
    }
    for (let y = 0; y <= size; y += tile) {
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(size, y)
      context.stroke()
    }

    context.fillStyle = 'rgba(255, 255, 255, 0.06)'
    for (let i = 0; i < 120; i++) {
      context.fillRect(Math.random() * size, Math.random() * size, 2, 2)
    }
  })
}

function createConcreteTexture({ base, accent } = {}) {
  return createTextureCanvas(512, (context, size) => {
    context.fillStyle = base
    context.fillRect(0, 0, size, size)

    context.fillStyle = accent
    for (let i = 0; i < 1500; i++) {
      const x = Math.random() * size
      const y = Math.random() * size
      context.fillRect(x, y, 1, 1)
    }

    context.strokeStyle = 'rgba(95, 91, 84, 0.28)'
    context.lineWidth = 3
    const slabs = [170, 342]
    for (const slab of slabs) {
      context.beginPath()
      context.moveTo(slab, 0)
      context.lineTo(slab, size)
      context.stroke()
      context.beginPath()
      context.moveTo(0, slab)
      context.lineTo(size, slab)
      context.stroke()
    }

    context.strokeStyle = 'rgba(255, 255, 255, 0.08)'
    context.lineWidth = 1.5
    context.beginPath()
    context.moveTo(0, 90)
    context.lineTo(size, 120)
    context.stroke()
    context.beginPath()
    context.moveTo(70, size)
    context.lineTo(120, 0)
    context.stroke()
  })
}

function createPlasterTexture({ base, accent } = {}) {
  return createTextureCanvas(512, (context, size) => {
    context.fillStyle = base
    context.fillRect(0, 0, size, size)

    context.fillStyle = accent
    for (let i = 0; i < 900; i++) {
      context.fillRect(Math.random() * size, Math.random() * size, 1, 1)
    }

    context.fillStyle = 'rgba(255, 255, 255, 0.04)'
    for (let i = 0; i < 45; i++) {
      const x = Math.random() * size
      const y = Math.random() * size
      context.beginPath()
      context.arc(x, y, 6 + Math.random() * 10, 0, Math.PI * 2)
      context.fill()
    }
  })
}

function createVerticalStripeWallpaperTexture({ base, accent } = {}) {
  return createTextureCanvas(512, (context, size) => {
    context.fillStyle = base
    context.fillRect(0, 0, size, size)

    for (let x = 0; x < size; x += 32) {
      context.fillStyle = x % 64 === 0 ? accent : 'rgba(255, 255, 255, 0.025)'
      context.fillRect(x, 0, 32, size)
    }

    context.strokeStyle = 'rgba(126, 93, 67, 0.06)'
    context.lineWidth = 1.25
    for (let y = 18; y < size; y += 36) {
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(size, y)
      context.stroke()
    }
  })
}

function createFloralWallpaperTexture({ base, accent } = {}) {
  return createTextureCanvas(512, (context, size) => {
    context.fillStyle = base
    context.fillRect(0, 0, size, size)

    const blooms = [
      [accent, '#9f6d63'],
      ['rgba(198, 176, 126, 0.92)', '#8f7a4d'],
      ['rgba(169, 192, 173, 0.9)', '#73907b']
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

        context.strokeStyle = 'rgba(103, 77, 63, 0.08)'
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

function createWainscotTexture({ base, accent } = {}) {
  return createTextureCanvas(512, (context, size) => {
    context.fillStyle = base
    context.fillRect(0, 0, size, size)

    context.fillStyle = accent
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

export function createFloorTexture(textureId = DEFAULT_FLOOR_TEXTURE_ID, colors = {}) {
  const id = normalizeFloorTextureId(textureId)
  const palette = normalizeSurfaceTextureColors('floor', id, colors)

  if (id === 'herringbone-oak') {
    return createWoodTexture({ base: palette.primaryColor, accent: palette.secondaryColor, grain: 'rgba(76, 46, 26, 0.22)', plankCount: 8, diagonal: true })
  }

  if (id === 'terrazzo-sand') {
    return createTerrazzoTexture({ base: palette.primaryColor, accent: palette.secondaryColor })
  }

  if (id === 'concrete-slab') {
    return createConcreteTexture({ base: palette.primaryColor, accent: palette.secondaryColor })
  }

  if (id === 'checker-tiles') {
    return createCheckerTileTexture({ base: palette.primaryColor, accent: palette.secondaryColor })
  }

  if (id === 'woven-carpet') {
    return createCarpetTexture({ base: palette.primaryColor, accent: palette.secondaryColor })
  }

  return createWoodTexture({ base: palette.primaryColor, accent: palette.secondaryColor, grain: 'rgba(75, 42, 18, 0.18)', plankCount: 6 })
}

export function createWallTexture(textureId = DEFAULT_WALL_TEXTURE_ID, colors = {}) {
  const id = normalizeWallTextureId(textureId)
  const palette = normalizeSurfaceTextureColors('wall', id, colors)

  if (id === 'vertical-stripes') {
    return createVerticalStripeWallpaperTexture({ base: palette.primaryColor, accent: palette.secondaryColor })
  }

  if (id === 'vintage-floral') {
    return createFloralWallpaperTexture({ base: palette.primaryColor, accent: palette.secondaryColor })
  }

  if (id === 'soft-plaster') {
    return createPlasterTexture({ base: palette.primaryColor, accent: palette.secondaryColor })
  }

  if (id === 'paneled-wainscot') {
    return createWainscotTexture({ base: palette.primaryColor, accent: palette.secondaryColor })
  }

  if (id === 'paper-bloom') {
    return createFloralWallpaperTexture({ base: palette.primaryColor, accent: palette.secondaryColor })
  }

  if (id === 'chalk-ridge') {
    return createPlasterTexture({ base: palette.primaryColor, accent: palette.secondaryColor })
  }

  return createPlasterTexture({ base: palette.primaryColor, accent: palette.secondaryColor })
}