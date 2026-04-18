import Room from '../backend/models/Room.js'
import RoomContribution from '../backend/models/RoomContribution.js'
import { connectToDatabase } from '../src/server/lib/mongodb.js'
import { getOptionalAuth } from '../src/server/middleware/optionalAuth.js'

function setJsonHeaders(res) {
	res.setHeader('Content-Type', 'application/json')
}

function parseBody(req) {
	if (!req.body) return {}
	if (typeof req.body === 'string') return JSON.parse(req.body)
	return req.body
}

function countWords(value) {
	return (value || '').trim().split(/\s+/).filter(Boolean).length
}

function normalizePathSegments(value) {
	if (Array.isArray(value)) return value.filter(Boolean).map(String)
	if (typeof value === 'string' && value.trim()) return value.split('/').filter(Boolean)
	return []
}

function resolveActorId(req, body, auth) {
	if (auth?.userId) return `user:${auth.userId}`
	const key = String(body.visitorKey || req.headers['x-visitor-key'] || '').trim()
	if (!key) return ''
	return `guest:${key}`
}

async function findPublicRoom(roomId) {
	return Room.findOne({
		_id: roomId,
		$or: [{ isPublic: true }, { isPublic: { $exists: false } }]
	})
}

export default async function handler(req, res) {
	setJsonHeaders(res)

	try {
		await connectToDatabase()

		const segments = normalizePathSegments(req.query.path)
		const roomId = segments[0]

		if (!roomId) {
			res.status(400).json({ error: 'Kamer-ID ontbreekt.' })
			return
		}

		const room = await findPublicRoom(roomId)
		if (!room) {
			res.status(404).json({ error: 'Publieke kamer niet gevonden.' })
			return
		}

		const action = segments.slice(1)

		if (action.length === 0) {
			if (req.method !== 'GET') {
				res.setHeader('Allow', ['GET'])
				res.status(405).json({ error: 'Method Not Allowed' })
				return
			}

			res.status(200).json({
				_id: room._id,
				name: room.name,
				sceneData: room.sceneData,
				ambience: room.ambience,
				roomReactions: room.roomReactions,
				roomComments: room.roomComments,
				createdAt: room.createdAt
			})
			return
		}

		const [resource, contributionId, nestedAction] = action

		if (resource === 'contributions' && !contributionId) {
			if (req.method === 'GET') {
				const items = await RoomContribution.find({ roomId: room._id, ownerId: room.ownerId }).sort({ createdAt: -1 })
				res.status(200).json(items)
				return
			}

			if (req.method === 'POST') {
				const auth = getOptionalAuth(req)
				const {
					type,
					giverName,
					tributeText = '',
					mediaUrl = '',
					externalUrl = '',
					platform = 'none'
				} = parseBody(req)

				const normalizedGiverName = String(giverName || auth?.email || '').trim()

				if (!type || !normalizedGiverName) {
					res.status(400).json({ error: 'Type en naam van gever zijn verplicht.' })
					return
				}

				if ((type === 'photo' || type === 'video_file') && !String(mediaUrl || '').trim()) {
					res.status(400).json({ error: 'Media-URL is verplicht voor foto en video bestanden.' })
					return
				}

				if ((type === 'video_url' || type === 'music_url') && !String(externalUrl || '').trim()) {
					res.status(400).json({ error: 'Externe URL is verplicht voor muziek en video links.' })
					return
				}

				if (countWords(tributeText) > 150) {
					res.status(400).json({ error: 'Tekst mag maximaal 150 woorden bevatten.' })
					return
				}

				const item = new RoomContribution({
					roomId: room._id,
					ownerId: room.ownerId,
					createdByUserId: auth?.userId || '',
					type,
					giverName: normalizedGiverName,
					tributeText: String(tributeText || '').trim(),
					mediaUrl: String(mediaUrl || '').trim(),
					externalUrl: String(externalUrl || '').trim(),
					platform
				})

				await item.save()
				res.status(201).json(item)
				return
			}

			res.setHeader('Allow', ['GET', 'POST'])
			res.status(405).json({ error: 'Method Not Allowed' })
			return
		}

		if (resource === 'contributions' && contributionId && nestedAction === 'reactions') {
			if (req.method !== 'POST') {
				res.setHeader('Allow', ['POST'])
				res.status(405).json({ error: 'Method Not Allowed' })
				return
			}

			const body = parseBody(req)
			const auth = getOptionalAuth(req)
			const actorId = resolveActorId(req, body, auth)

			if (!actorId) {
				res.status(400).json({ error: 'Bezoeker sleutel ontbreekt.' })
				return
			}

			const item = await RoomContribution.findOne({ _id: contributionId, roomId: room._id, ownerId: room.ownerId })
			if (!item) {
				res.status(404).json({ error: 'Bijdrage niet gevonden.' })
				return
			}

			const reactionType = String(body.reactionType || '').trim()
			const fieldByType = {
				heart: 'heartCount',
				support: 'supportCount',
				candle: 'candleCount'
			}
			const reactionField = fieldByType[reactionType]

			if (!reactionField) {
				res.status(400).json({ error: 'Onbekend reactietype.' })
				return
			}

			const existingIndex = (item.reactedUsers || []).findIndex((entry) => entry.userId === actorId)
			const existing = existingIndex >= 0 ? item.reactedUsers[existingIndex] : null

			if (existing?.reactionType === reactionType) {
				item.reactions[reactionField] = Math.max(0, (item.reactions?.[reactionField] || 0) - 1)
				item.reactedUsers.splice(existingIndex, 1)
			} else {
				if (existing?.reactionType) {
					const oldField = `${existing.reactionType}Count`
					item.reactions[oldField] = Math.max(0, (item.reactions?.[oldField] || 0) - 1)
					item.reactedUsers[existingIndex].reactionType = reactionType
				} else {
					item.reactedUsers.push({ userId: actorId, reactionType })
				}

				item.reactions[reactionField] = (item.reactions?.[reactionField] || 0) + 1
			}

			await item.save()
			res.status(200).json(item)
			return
		}

		if (resource === 'contributions' && contributionId && nestedAction === 'comments') {
			if (req.method !== 'POST') {
				res.setHeader('Allow', ['POST'])
				res.status(405).json({ error: 'Method Not Allowed' })
				return
			}

			const auth = getOptionalAuth(req)
			const item = await RoomContribution.findOne({ _id: contributionId, roomId: room._id, ownerId: room.ownerId })
			if (!item) {
				res.status(404).json({ error: 'Bijdrage niet gevonden.' })
				return
			}

			const body = parseBody(req)
			const text = String(body.text || '').trim()
			const displayName = String(body.displayName || auth?.email || 'Bezoeker').trim()

			if (!text) {
				res.status(400).json({ error: 'Commentaar mag niet leeg zijn.' })
				return
			}

			if (text.length > 500) {
				res.status(400).json({ error: 'Commentaar mag maximaal 500 tekens bevatten.' })
				return
			}

			item.comments.push({
				userId: auth?.userId || '',
				displayName,
				text
			})

			await item.save()
			res.status(200).json(item)
			return
		}

		if (resource === 'room-reactions') {
			if (req.method !== 'POST') {
				res.setHeader('Allow', ['POST'])
				res.status(405).json({ error: 'Method Not Allowed' })
				return
			}

			const body = parseBody(req)
			const auth = getOptionalAuth(req)
			const actorId = resolveActorId(req, body, auth)

			if (!actorId) {
				res.status(400).json({ error: 'Bezoeker sleutel ontbreekt.' })
				return
			}

			const reactionType = String(body.reactionType || '').trim()
			const fieldByType = {
				heart: 'heartCount',
				support: 'supportCount',
				candle: 'candleCount'
			}
			const reactionField = fieldByType[reactionType]

			if (!reactionField) {
				res.status(400).json({ error: 'Onbekend reactietype.' })
				return
			}

			const existingIndex = (room.roomReactedUsers || []).findIndex((entry) => entry.userId === actorId)
			const existing = existingIndex >= 0 ? room.roomReactedUsers[existingIndex] : null

			if (existing?.reactionType === reactionType) {
				room.roomReactions[reactionField] = Math.max(0, (room.roomReactions?.[reactionField] || 0) - 1)
				room.roomReactedUsers.splice(existingIndex, 1)
			} else {
				if (existing?.reactionType) {
					const oldField = `${existing.reactionType}Count`
					room.roomReactions[oldField] = Math.max(0, (room.roomReactions?.[oldField] || 0) - 1)
					room.roomReactedUsers[existingIndex].reactionType = reactionType
				} else {
					room.roomReactedUsers.push({ userId: actorId, reactionType })
				}

				room.roomReactions[reactionField] = (room.roomReactions?.[reactionField] || 0) + 1
			}

			await room.save()
			res.status(200).json(room)
			return
		}

		if (resource === 'room-comments') {
			if (req.method !== 'POST') {
				res.setHeader('Allow', ['POST'])
				res.status(405).json({ error: 'Method Not Allowed' })
				return
			}

			const auth = getOptionalAuth(req)
			const body = parseBody(req)
			const text = String(body.text || '').trim()
			const displayName = String(body.displayName || auth?.email || 'Bezoeker').trim()

			if (!text) {
				res.status(400).json({ error: 'Commentaar mag niet leeg zijn.' })
				return
			}

			if (text.length > 500) {
				res.status(400).json({ error: 'Commentaar mag maximaal 500 tekens bevatten.' })
				return
			}

			room.roomComments.push({
				userId: auth?.userId || '',
				displayName,
				text
			})

			await room.save()
			res.status(200).json(room)
			return
		}

		res.status(404).json({ error: 'Route niet gevonden.' })
	} catch (error) {
		console.error('public-handler error:', error)
		res.status(500).json({ error: 'A server error has occurred' })
	}
}