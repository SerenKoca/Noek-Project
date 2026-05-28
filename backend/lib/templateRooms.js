const TEMPLATE_ROOM_KEYS = ['template-a', 'template-b']

const TEMPLATE_ROOM_NAMES = {
  'template-a': 'Template 1',
  'template-b': 'Template 2'
}

function normalizeTemplateKey(value, fallback = 'template-a') {
  const key = String(value || '').trim().toLowerCase()
  return TEMPLATE_ROOM_KEYS.includes(key) ? key : fallback
}

function getTemplateRoomName(templateKey) {
  const key = normalizeTemplateKey(templateKey)
  return TEMPLATE_ROOM_NAMES[key] || 'Template kamer'
}

module.exports = {
  TEMPLATE_ROOM_KEYS,
  TEMPLATE_ROOM_NAMES,
  normalizeTemplateKey,
  getTemplateRoomName
}