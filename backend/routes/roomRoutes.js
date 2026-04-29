const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const {
  getRoomTemplate,
  createRoom,
  getRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
  getRoomContributions,
  createRoomContribution,
  reactToRoomContribution,
  addRoomContributionComment,
  updateRoomMusic,
  reactToRoom,
  addRoomComment
} = require('../controllers/roomController');

router.use(requireAuth);

router.get('/template', getRoomTemplate);
router.post('/', createRoom);
router.get('/', getRooms);
router.get('/:id/contributions', getRoomContributions);
router.post('/:id/contributions', createRoomContribution);
router.post('/:id/contributions/:contributionId/reactions', reactToRoomContribution);
router.post('/:id/contributions/:contributionId/comments', addRoomContributionComment);
router.patch('/:id/music', updateRoomMusic);
router.post('/:id/room-reactions', reactToRoom);
router.post('/:id/room-comments', addRoomComment);
router.get('/:id', getRoomById);
router.put('/:id', updateRoom);
router.delete('/:id', deleteRoom);

module.exports = router;
