const DEFAULT_BRANDING = {
  logoUrl: '',
  directorName: 'Noek',
  darkColor: '#1e2b37',
  lightColor: '#d7e1eb'
}

function normalizeHexColor(input, fallback) {
  const value = String(input || '').trim().toLowerCase()
  return /^#[0-9a-f]{6}$/.test(value) ? value : fallback
}

function hexToRgb(hex) {
  const value = normalizeHexColor(hex, '#000000')
  return {
    r: parseInt(value.slice(1, 3), 16),
    g: parseInt(value.slice(3, 5), 16),
    b: parseInt(value.slice(5, 7), 16)
  }
}

function rgbToHex({ r, g, b }) {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)))
  const toHex = (n) => clamp(n).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function shade(hex, amount) {
  const { r, g, b } = hexToRgb(hex)
  return rgbToHex({
    r: r + amount,
    g: g + amount,
    b: b + amount
  })
}

function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex)
  const channel = (v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function normalizeBranding(input = {}) {
  return {
    logoUrl: String(input.logoUrl || '').trim(),
    directorName: String(input.directorName || DEFAULT_BRANDING.directorName).trim() || DEFAULT_BRANDING.directorName,
    darkColor: normalizeHexColor(input.darkColor, DEFAULT_BRANDING.darkColor),
    lightColor: normalizeHexColor(input.lightColor, DEFAULT_BRANDING.lightColor)
  }
}

export function getDefaultBranding() {
  return { ...DEFAULT_BRANDING }
}

export function applyBrandingTheme(input = {}) {
  if (typeof document === 'undefined') return normalizeBranding(input)

  const branding = normalizeBranding(input)
  const root = document.documentElement

  const dark = branding.darkColor
  const light = branding.lightColor
  const darkHover = shade(dark, -18)
  const darkSoft = shade(dark, 70)
  const darkMuted = shade(dark, 95)
  const lightHover = shade(light, -10)
  const panelSoft = shade(light, 10)
  const border = shade(light, -24)
  const borderStrong = shade(dark, 44)
  const textColor = dark
  const textSoft = darkSoft
  const textMuted = darkMuted
  const buttonText = relativeLuminance(dark) > 0.5 ? '#102438' : '#ffffff'

  root.style.setProperty('--brand-dark', dark)
  root.style.setProperty('--brand-light', light)
  root.style.setProperty('--editor-brand', dark)
  root.style.setProperty('--editor-btn', light)
  root.style.setProperty('--editor-btn-hover', lightHover)
  root.style.setProperty('--editor-panel', light)
  root.style.setProperty('--editor-panel-soft', panelSoft)
  root.style.setProperty('--editor-border', border)
  root.style.setProperty('--editor-border-strong', borderStrong)
  root.style.setProperty('--editor-bg-page', dark)
  root.style.setProperty('--editor-bg-shell-bottom', light)
  root.style.setProperty('--editor-text', textColor)
  root.style.setProperty('--editor-text-soft', textSoft)
  root.style.setProperty('--editor-text-muted', textMuted)
  root.style.setProperty('--editor-btn-text', buttonText)
  root.style.setProperty('--editor-primary-hover', darkHover)

  return branding
}
