export async function getSoundLibrary() {
  try {
    const response = await fetch('/sounds/sound-manifest.json', { cache: 'no-store' })
    if (!response.ok) {
      return { sounds: [], error: 'Kon geluidsbibliotheek niet laden.' }
    }

    const payload = await response.json()
    const sounds = Array.isArray(payload)
      ? payload
          .map((item) => ({
            id: String(item?.id || ''),
            title: String(item?.title || '').trim(),
            url: String(item?.url || '').trim(),
            category: String(item?.category || 'Overig').trim() || 'Overig'
          }))
          .filter((item) => item.id && item.title && item.url)
      : []

    return { sounds, error: '' }
  } catch {
    return { sounds: [], error: 'Kon geluidsbibliotheek niet laden.' }
  }
}
