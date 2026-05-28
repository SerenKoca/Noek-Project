const Room = require('../models/Room');
const RoomContribution = require('../models/RoomContribution');
const { createRoomEditKey } = require('../lib/roomEditAuth')
const { normalizeTemplateKey, getTemplateRoomName } = require('../lib/templateRooms')

const ROOM_TEMPLATE_OWNER_EMAIL = String(
  process.env.ROOM_TEMPLATE_OWNER_EMAIL || process.env.VITE_ROOM_TEMPLATE_OWNER_EMAIL || 'editor@test.be'
).trim().toLowerCase();

function countWords(value) {
  return (value || '').trim().split(/\s+/).filter(Boolean).length;
}

async function findOwnedRoom(roomId, ownerId) {
  return Room.findOne({ _id: roomId, ownerId });
}

async function findOwnedContribution(roomId, ownerId, contributionId) {
  return RoomContribution.findOne({ _id: contributionId, roomId, ownerId });
}

function buildTemplateSlots() {
  return [
    {
      id: 'slot-sofa',
      label: 'Zetel',
      accepts: ['meubel'],
      position: [-6.8, 0, -12.2],
      rotationY: Math.PI * 0.97,
      initialModel: {
        id: 'ZOPP3KzNIk',
        title: 'Couch Small',
        url: 'https://static.poly.pizza/4e8fbbf3-9992-4068-8918-2126a0304127.glb',
        scaleMultiplier: 1.22,
        rotationYOffset: 0.08
      }
    },
    {
      id: 'slot-armchair-right',
      label: 'Zetel',
      accepts: ['meubel'],
      position: [-2.3, 0, -14.8],
      rotationY: Math.PI * 1.14,
      initialModel: {
        id: 'myd1WSucAz',
        title: 'Armchair',
        url: 'https://static.poly.pizza/2584a961-1b06-4fb7-ba7d-1074b52ca908.glb',
        scaleMultiplier: 1.05,
        rotationYOffset: -0.05
      }
    },
    {
      id: 'slot-table',
      label: 'Tafel',
      accepts: ['meubel', 'decoratie', 'persoonlijk'],
      position: [-2.2, 0, -9.2],
      rotationY: Math.PI * 0.95,
      initialModel: {
        id: 'rAEBvfb1FT',
        title: 'Small Table',
        url: 'https://static.poly.pizza/0f319f3b-b0d6-4691-bae5-c6c6e612df99.glb',
        scaleMultiplier: 1.08,
        rotationYOffset: 0.05
      }
    },
    {
      id: 'slot-candle-side',
      label: 'Decoratie klein',
      accepts: ['decoratie', 'persoonlijk'],
      position: [-4.9, 1.15, -7.9],
      rotationY: Math.PI * 0.1,
      initialModel: {
        id: 'tknOVwxT8B',
        title: 'Candlestick',
        url: 'https://static.poly.pizza/e6c65b91-0e3a-45f6-8e9e-9da5faa3f91d.glb',
        scaleMultiplier: 0.46,
        rotationYOffset: 0
      }
    },
    {
      id: 'slot-tv',
      label: 'Media',
      accepts: ['meubel'],
      position: [6.2, 0, -12.6],
      rotationY: Math.PI,
      initialModel: {
        id: '9trLeWoBek',
        title: 'Television',
        url: 'https://static.poly.pizza/1ddcd36c-ac9e-4dc2-a056-846cea033c02.glb',
        scaleMultiplier: 1.06,
        rotationYOffset: 0
      }
    },
    {
      id: 'slot-shelf',
      label: 'Kast',
      accepts: ['meubel', 'persoonlijk', 'decoratie'],
      position: [9.3, 0, -8.1],
      rotationY: Math.PI * 1.44,
      initialModel: {
        id: 'tACDGJ4CGW',
        title: 'Bookcase with Books',
        url: 'https://static.poly.pizza/7d59d0aa-6447-4bbb-afc7-0452e9a34353.glb',
        scaleMultiplier: 1.14,
        rotationYOffset: -0.08
      }
    },
    {
      id: 'slot-hat-stand',
      label: 'Lamp',
      accepts: ['meubel', 'decoratie'],
      position: [11.8, 0, -12.9],
      rotationY: Math.PI * 1.55,
      initialModel: {
        id: 'IWnizIOIyu',
        title: 'Hat Stand',
        url: 'https://static.poly.pizza/f9aa955b-0515-4d32-8b27-0e48062b7c34.glb',
        scaleMultiplier: 1.18,
        rotationYOffset: 0
      }
    }
  ]
}

function normalizeRoomReactionType(value) {
  const fieldByType = {
    heart: 'heartCount',
    support: 'supportCount',
    candle: 'candleCount'
  };
  const reactionType = (value || '').trim();
  const reactionField = fieldByType[reactionType];
  return { reactionType, reactionField };
}

function buildFallbackTemplateSceneData(templateSlots = [], templateKey = 'template-a') {
  return {
    templateSlots: Array.isArray(templateSlots) ? templateSlots : [],
    furniture: [],
    appearance: {},
    metadata: {
      generatedAt: new Date().toISOString(),
      source: 'fallback-template',
      templateKey: normalizeTemplateKey(templateKey)
    }
  };
}

exports.getRoomTemplate = async (req, res) => {
  try {
    if (req.auth?.role !== 'editor') {
      return res.status(403).json({ error: 'Alleen editors kunnen de template gebruiken.' });
    }

    const templateKey = normalizeTemplateKey(req.query?.templateKey || req.query?.variant)

    // Load User model first, then optionally attempt to load the frontend ROOM_TEMPLATE.
    const userModule = await import('../models/User.js')
    const UserModel = userModule.default || userModule.User || userModule
    const templateSlots = buildTemplateSlots()
    const templateOwner = await UserModel.findOne({
      email: ROOM_TEMPLATE_OWNER_EMAIL,
      role: { $in: ['editor', 'admin'] }
    });

    if (templateOwner) {
      const templateRoom = templateKey === 'template-a'
        ? await Room.findOne({
            ownerId: templateOwner._id,
            $or: [
              { templateKey: 'template-a' },
              { templateKey: '' },
              { templateKey: { $exists: false } }
            ]
          }).sort({ createdAt: 1 })
        : await Room.findOne({ ownerId: templateOwner._id, templateKey }).sort({ createdAt: 1 });
      if (templateRoom?.sceneData) {
        return res.json({
          sceneData: templateRoom.sceneData,
          roomId: templateRoom._id,
          templateKey,
          name: templateRoom.name || getTemplateRoomName(templateKey),
          source: 'template-room'
        });
      }

      if (templateKey === 'template-b') {
        const seedRoom = await Room.findOne({
          ownerId: templateOwner._id,
          $or: [
            { templateKey: 'template-a' },
            { templateKey: '' },
            { templateKey: { $exists: false } }
          ]
        }).sort({ createdAt: 1 });

        if (seedRoom?.sceneData) {
          return res.json({
            sceneData: JSON.parse(JSON.stringify(seedRoom.sceneData)),
            roomId: seedRoom._id,
            templateKey,
            name: getTemplateRoomName(templateKey),
            source: 'template-copy'
          });
        }
      }
    }

    return res.json({
      sceneData: buildFallbackTemplateSceneData(templateSlots, templateKey),
      templateKey,
      name: getTemplateRoomName(templateKey),
      source: 'fallback-template'
    });
  } catch (error) {
    console.error('getRoomTemplate error:', error);
    res.status(500).json({ error: 'Kon begintemplate niet ophalen.' });
  }
};

exports.issueRoomEditLink = async (req, res) => {
  try {
    const room = await Room.findOne({ _id: req.params.id, ownerId: req.auth?.userId })

    if (!room) {
      return res.status(404).json({ error: 'Kamer niet gevonden.' })
    }

    if (!room.editKey) {
      room.editKey = createRoomEditKey(room._id.toString())
      await room.save()
    }

    return res.json({
      editKey: room.editKey
    })
  } catch (error) {
    console.error('issueRoomEditLink error:', error)
    return res.status(500).json({ error: 'Kon bewerklink niet maken.' })
  }
}

exports.createRoom = async (req, res) => {
  try {
    if (req.auth?.role !== 'editor') {
      return res.status(403).json({ error: 'Alleen editors kunnen kamers beheren.' });
    }

    const { name, userId, sceneData, templateKey } = req.body;
    const ownerId = req.auth?.userId;
    const normalizedTemplateKey = normalizeTemplateKey(templateKey, '')

    if (!name || !sceneData) {
      return res.status(400).json({ error: 'Naam en sceneData zijn verplicht.' });
    }

    if (templateKey && !normalizedTemplateKey) {
      return res.status(400).json({ error: 'Onbekende template.' });
    }

    const existingRoomCount = await Room.countDocuments({ ownerId });
    if (existingRoomCount >= 2) {
      return res.status(403).json({ error: 'Elk account mag maar 2 kamers hebben.' });
    }

    const room = new Room({
      name,
      userId: userId || null,
      ownerId,
      sceneData,
      templateKey: normalizedTemplateKey || '',
      editKey: createRoomEditKey(String(ownerId))
    });
    await room.save();

    res.status(201).json(room);
  } catch (error) {
    console.error('createRoom error:', error);
    res.status(500).json({ error: 'Kon de kamer niet opslaan.' });
  }
};

exports.getRooms = async (req, res) => {
  try {
    if (req.auth?.role !== 'editor') {
      return res.status(403).json({ error: 'Alleen editors kunnen kamers beheren.' });
    }

    const rooms = await Room.find({ ownerId: req.auth?.userId }).sort({ createdAt: -1 });
    res.json(rooms);
  } catch (error) {
    console.error('getRooms error:', error);
    res.status(500).json({ error: 'Kon kamers niet ophalen.' });
  }
};

exports.getRoomById = async (req, res) => {
  try {
    if (req.auth?.role !== 'editor') {
      return res.status(403).json({ error: 'Alleen editors kunnen kamers beheren.' });
    }

    const room = await Room.findOne({ _id: req.params.id, ownerId: req.auth?.userId });
    if (!room) {
      return res.status(404).json({ error: 'Kamer niet gevonden.' });
    }
    res.json(room);
  } catch (error) {
    console.error('getRoomById error:', error);
    res.status(500).json({ error: 'Kon kamer niet ophalen.' });
  }
};

exports.updateRoom = async (req, res) => {
  try {
    if (req.auth?.role !== 'editor') {
      return res.status(403).json({ error: 'Alleen editors kunnen kamers beheren.' });
    }

    const { name, sceneData } = req.body;

    const updates = {};
    if (typeof name === 'string' && name.trim()) {
      updates.name = name.trim();
    }
    if (sceneData) {
      updates.sceneData = sceneData;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'Minstens naam of sceneData is verplicht.' });
    }

    const room = await Room.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.auth?.userId },
      updates,
      { returnDocument: 'after', runValidators: true }
    );

    if (!room) {
      return res.status(404).json({ error: 'Kamer niet gevonden.' });
    }

    res.json(room);
  } catch (error) {
    console.error('updateRoom error:', error);
    res.status(500).json({ error: 'Kon de kamer niet bijwerken.' });
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    if (req.auth?.role !== 'editor') {
      return res.status(403).json({ error: 'Alleen editors kunnen kamers beheren.' });
    }

    const room = await Room.findOneAndDelete({ _id: req.params.id, ownerId: req.auth?.userId });
    if (!room) {
      return res.status(404).json({ error: 'Kamer niet gevonden.' });
    }
    res.json({ message: 'Kamer verwijderd.' });
  } catch (error) {
    console.error('deleteRoom error:', error);
    res.status(500).json({ error: 'Kon kamer niet verwijderen.' });
  }
};

exports.getRoomContributions = async (req, res) => {
  try {
    const ownerId = req.auth?.userId;
    const room = await findOwnedRoom(req.params.id, ownerId);

    if (!room) {
      return res.status(404).json({ error: 'Kamer niet gevonden.' });
    }

    const items = await RoomContribution.find({ roomId: room._id, ownerId }).sort({ createdAt: -1 });
    return res.json(items);
  } catch (error) {
    console.error('getRoomContributions error:', error);
    return res.status(500).json({ error: 'Kon bijdragen niet ophalen.' });
  }
};

exports.createRoomContribution = async (req, res) => {
  try {
    const ownerId = req.auth?.userId;
    const room = await findOwnedRoom(req.params.id, ownerId);

    if (!room) {
      return res.status(404).json({ error: 'Kamer niet gevonden.' });
    }

    const {
      type,
      giverName,
      tributeText = '',
      mediaUrl = '',
      externalUrl = '',
      platform = 'none'
    } = req.body || {};

    if (!type || !giverName?.trim()) {
      return res.status(400).json({ error: 'Type en naam van gever zijn verplicht.' });
    }

    if ((type === 'photo' || type === 'video_file') && !mediaUrl.trim()) {
      return res.status(400).json({ error: 'Media-URL is verplicht voor foto en video bestanden.' });
    }

    if ((type === 'video_url' || type === 'music_url') && !externalUrl.trim()) {
      return res.status(400).json({ error: 'Externe URL is verplicht voor muziek en video links.' });
    }

    if (countWords(tributeText) > 150) {
      return res.status(400).json({ error: 'Tekst mag maximaal 150 woorden bevatten.' });
    }

    const contribution = new RoomContribution({
      roomId: room._id,
      ownerId,
      createdByUserId: ownerId,
      type,
      giverName: giverName.trim(),
      tributeText: tributeText.trim(),
      mediaUrl: mediaUrl.trim(),
      externalUrl: externalUrl.trim(),
      platform
    });

    await contribution.save();
    return res.status(201).json(contribution);
  } catch (error) {
    console.error('createRoomContribution error:', error);
    return res.status(500).json({ error: 'Kon bijdrage niet opslaan.' });
  }
};

exports.reactToRoomContribution = async (req, res) => {
  try {
    const ownerId = req.auth?.userId;
    const room = await findOwnedRoom(req.params.id, ownerId);

    if (!room) {
      return res.status(404).json({ error: 'Kamer niet gevonden.' });
    }

    const contribution = await findOwnedContribution(room._id, ownerId, req.params.contributionId);
    if (!contribution) {
      return res.status(404).json({ error: 'Bijdrage niet gevonden.' });
    }

    const reactionType = (req.body?.reactionType || '').trim();
    const fieldByType = {
      heart: 'heartCount',
      support: 'supportCount',
      candle: 'candleCount'
    };
    const reactionField = fieldByType[reactionType];

    if (!reactionField) {
      return res.status(400).json({ error: 'Onbekend reactietype.' });
    }

    const userId = ownerId;
    const fieldByTypeReverse = {
      heartCount: 'heart',
      supportCount: 'support',
      candleCount: 'candle'
    };

    const existingIndex = (contribution.reactedUsers || []).findIndex((entry) => entry.userId === userId);
    const existing = existingIndex >= 0 ? contribution.reactedUsers[existingIndex] : null;

    if (existing?.reactionType === reactionType) {
      const current = contribution.reactions?.[reactionField] || 0;
      contribution.reactions[reactionField] = Math.max(0, current - 1);
      contribution.reactedUsers.splice(existingIndex, 1);
    } else {
      if (existing?.reactionType) {
        const oldField = `${existing.reactionType}Count`;
        if (fieldByTypeReverse[oldField]) {
          contribution.reactions[oldField] = Math.max(0, (contribution.reactions?.[oldField] || 0) - 1);
        }
        contribution.reactedUsers[existingIndex].reactionType = reactionType;
      } else {
        contribution.reactedUsers.push({ userId, reactionType });
      }

      contribution.reactions[reactionField] = (contribution.reactions?.[reactionField] || 0) + 1;
    }

    await contribution.save();

    return res.json(contribution);
  } catch (error) {
    console.error('reactToRoomContribution error:', error);
    return res.status(500).json({ error: 'Kon reactie niet opslaan.' });
  }
};

exports.addRoomContributionComment = async (req, res) => {
  try {
    const ownerId = req.auth?.userId;
    const room = await findOwnedRoom(req.params.id, ownerId);

    if (!room) {
      return res.status(404).json({ error: 'Kamer niet gevonden.' });
    }

    const contribution = await findOwnedContribution(room._id, ownerId, req.params.contributionId);
    if (!contribution) {
      return res.status(404).json({ error: 'Bijdrage niet gevonden.' });
    }

    const text = (req.body?.text || '').trim();
    const displayName = (req.body?.displayName || req.auth?.email || 'Gebruiker').trim();

    if (!text) {
      return res.status(400).json({ error: 'Commentaar mag niet leeg zijn.' });
    }

    if (text.length > 500) {
      return res.status(400).json({ error: 'Commentaar mag maximaal 500 tekens bevatten.' });
    }

    contribution.comments.push({
      userId: ownerId,
      displayName,
      text
    });
    await contribution.save();

    return res.json(contribution);
  } catch (error) {
    console.error('addRoomContributionComment error:', error);
    return res.status(500).json({ error: 'Kon commentaar niet opslaan.' });
  }
};

exports.updateRoomMusic = async (req, res) => {
  try {
    const ownerId = req.auth?.userId;
    const room = await findOwnedRoom(req.params.id, ownerId);

    if (!room) {
      return res.status(404).json({ error: 'Kamer niet gevonden.' });
    }

    const musicUrl = String(req.body?.musicUrl || '').trim();
    const volumeRaw = Number(req.body?.volume);
    const volume = Number.isFinite(volumeRaw) ? Math.min(1, Math.max(0, volumeRaw)) : 0.35;

    room.ambience = {
      musicUrl,
      volume
    };

    await room.save();
    return res.json(room);
  } catch (error) {
    console.error('updateRoomMusic error:', error);
    return res.status(500).json({ error: 'Kon kamermuziek niet opslaan.' });
  }
};

exports.reactToRoom = async (req, res) => {
  try {
    const ownerId = req.auth?.userId;
    const room = await findOwnedRoom(req.params.id, ownerId);

    if (!room) {
      return res.status(404).json({ error: 'Kamer niet gevonden.' });
    }

    const { reactionType, reactionField } = normalizeRoomReactionType(req.body?.reactionType);
    if (!reactionField) {
      return res.status(400).json({ error: 'Onbekend reactietype.' });
    }

    const userId = ownerId;
    const existingIndex = (room.roomReactedUsers || []).findIndex((entry) => entry.userId === userId);
    const existing = existingIndex >= 0 ? room.roomReactedUsers[existingIndex] : null;

    if (existing?.reactionType === reactionType) {
      room.roomReactions[reactionField] = Math.max(0, (room.roomReactions?.[reactionField] || 0) - 1);
      room.roomReactedUsers.splice(existingIndex, 1);
    } else {
      if (existing?.reactionType) {
        const oldField = `${existing.reactionType}Count`;
        room.roomReactions[oldField] = Math.max(0, (room.roomReactions?.[oldField] || 0) - 1);
        room.roomReactedUsers[existingIndex].reactionType = reactionType;
      } else {
        room.roomReactedUsers.push({ userId, reactionType });
      }

      room.roomReactions[reactionField] = (room.roomReactions?.[reactionField] || 0) + 1;
    }

    await room.save();
    return res.json(room);
  } catch (error) {
    console.error('reactToRoom error:', error);
    return res.status(500).json({ error: 'Kon kamerreactie niet opslaan.' });
  }
};

exports.addRoomComment = async (req, res) => {
  try {
    const ownerId = req.auth?.userId;
    const room = await findOwnedRoom(req.params.id, ownerId);

    if (!room) {
      return res.status(404).json({ error: 'Kamer niet gevonden.' });
    }

    const text = (req.body?.text || '').trim();
    const displayName = (req.body?.displayName || req.auth?.email || 'Gebruiker').trim();

    if (!text) {
      return res.status(400).json({ error: 'Commentaar mag niet leeg zijn.' });
    }

    if (text.length > 500) {
      return res.status(400).json({ error: 'Commentaar mag maximaal 500 tekens bevatten.' });
    }

    room.roomComments.push({
      userId: ownerId,
      displayName,
      text
    });

    await room.save();
    return res.json(room);
  } catch (error) {
    console.error('addRoomComment error:', error);
    return res.status(500).json({ error: 'Kon kamercommentaar niet opslaan.' });
  }
};
