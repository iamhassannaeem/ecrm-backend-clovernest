const express = require('express');
const router = express.Router();
const userTeamController = require('../controllers/userTeamController');

router.post('/', userTeamController.createUserTeam);
router.get('/', userTeamController.getUserTeams);
router.get('/:id', userTeamController.getUserTeamById);
router.put('/:id', userTeamController.updateUserTeam);
router.delete('/:id', userTeamController.deleteUserTeam);

module.exports = router; 