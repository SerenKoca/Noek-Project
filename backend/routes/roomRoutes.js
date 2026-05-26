const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { requireRoomAccess } = require('../middleware/roomAccessMiddleware')
const {
  getRoomTemplate,
  createRoom,
  getRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
  issueRoomEditLink,
  getRoomContributions,
  createRoomContribution,
  reactToRoomContribution,
  addRoomContributionComment,
  updateRoomMusic,
  reactToRoom,
  addRoomComment
} = require('../controllers/roomController');

router.get('/template', requireAuth, getRoomTemplate);
router.post('/', requireAuth, createRoom);
router.get('/', requireAuth, getRooms);

router.post('/:id/edit-link', requireAuth, requireRole('editor'), issueRoomEditLink)

router.use('/:id', requireRoomAccess)

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
