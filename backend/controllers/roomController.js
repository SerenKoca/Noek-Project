const Room = require('../models/Room');
const RoomContribution = require('../models/RoomContribution');

function countWords(value) {
  return (value || '').trim().split(/\s+/).filter(Boolean).length;
}

async function findOwnedRoom(roomId, ownerId) {
  return Room.findOne({ _id: roomId, ownerId });
}

async function findOwnedContribution(roomId, ownerId, contributionId) {
  return RoomContribution.findOne({ _id: contributionId, roomId, ownerId });
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

exports.createRoom = async (req, res) => {
  try {
    if (req.auth?.role !== 'editor') {
      return res.status(403).json({ error: 'Alleen editors kunnen kamers beheren.' });
    }

    const { name, userId, sceneData } = req.body;
    const ownerId = req.auth?.userId;

    if (!name || !sceneData) {
      return res.status(400).json({ error: 'Naam en sceneData zijn verplicht.' });
    }

    const existingRoomCount = await Room.countDocuments({ ownerId });
    if (existingRoomCount >= 2) {
      return res.status(403).json({ error: 'Elk account mag maar 2 kamers hebben.' });
    }

    const room = new Room({ name, userId: userId || null, ownerId, sceneData });
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
      { new: true, runValidators: true }
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
