import { Router } from 'express';
import { createTeam, joinTeam, getMyTeams } from '../controllers/teamController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/', authenticateToken, getMyTeams);
router.post('/', authenticateToken, createTeam);
router.post('/join', authenticateToken, joinTeam);

export default router;
