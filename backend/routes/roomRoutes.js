const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const {
  createRoom,
  getRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
  getRoomContributions,
  createRoomContribution,
  reactToRoomContribution,
  addRoomContributionComment
} = require('../controllers/roomController');

router.use(requireAuth);

router.post('/', createRoom);
router.get('/', getRooms);
router.get('/:id/contributions', getRoomContributions);
router.post('/:id/contributions', createRoomContribution);
router.post('/:id/contributions/:contributionId/reactions', reactToRoomContribution);
router.post('/:id/contributions/:contributionId/comments', addRoomContributionComment);
router.get('/:id', getRoomById);
router.put('/:id', updateRoom);
router.delete('/:id', deleteRoom);

module.exports = router;
