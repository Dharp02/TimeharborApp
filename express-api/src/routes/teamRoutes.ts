import { Router } from 'express';
import { createTeam, joinTeam, getMyTeams, updateTeam, deleteTeam } from '../controllers/teamController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/', authenticateToken, getMyTeams);
router.post('/', authenticateToken, createTeam);
router.post('/join', authenticateToken, joinTeam);
router.put('/:id', authenticateToken, updateTeam);
router.delete('/:id', authenticateToken, deleteTeam);

export default router;
