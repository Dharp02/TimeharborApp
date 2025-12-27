import { Router } from 'express';
import { createTeam } from '../controllers/teamController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/', authenticateToken, createTeam);

export default router;
