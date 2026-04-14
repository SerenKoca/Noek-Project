const Room = require('../models/Room');
const RoomContribution = require('../models/RoomContribution');

function countWords(value) {
  return (value || '').trim().split(/\s+/).filter(Boolean).length;
}

async function findOwnedRoom(roomId, ownerId) {
  return Room.findOne({ _id: roomId, ownerId });
}

exports.createRoom = async (req, res) => {
  try {
    const { name, userId, sceneData } = req.body;
    const ownerId = req.auth?.userId;

    if (!name || !sceneData) {
      return res.status(400).json({ error: 'Naam en sceneData zijn verplicht.' });
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
    const rooms = await Room.find({ ownerId: req.auth?.userId }).sort({ createdAt: -1 });
    res.json(rooms);
  } catch (error) {
    console.error('getRooms error:', error);
    res.status(500).json({ error: 'Kon kamers niet ophalen.' });
  }
};

exports.getRoomById = async (req, res) => {
  try {
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
    const { name, sceneData } = req.body;

    if (!name || !sceneData) {
      return res.status(400).json({ error: 'Naam en sceneData zijn verplicht.' });
    }

    const room = await Room.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.auth?.userId },
      { name, sceneData },
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
