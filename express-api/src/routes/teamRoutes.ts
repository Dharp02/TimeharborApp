import { Router } from 'express';
import { createTeam, joinTeam } from '../controllers/teamController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/', authenticateToken, createTeam);
router.post('/join', authenticateToken, joinTeam);

export default router;
