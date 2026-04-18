import roomsIndexHandler from './rooms/index.js'
import roomsPathHandler from './rooms/[...path].js'

function hasPathParam(value) {
  if (Array.isArray(value)) return value.length > 0
  return typeof value === 'string' && value.trim().length > 0
}

export default async function handler(req, res) {
  if (hasPathParam(req?.query?.path)) {
    await roomsPathHandler(req, res)
    return
  }

  await roomsIndexHandler(req, res)
}