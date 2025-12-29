import { Router } from 'express';
import { createTeam, joinTeam, getMyTeams, updateTeam, deleteTeam, addMember, removeMember } from '../controllers/teamController';
import ticketRoutes from './ticketRoutes';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/', authenticateToken, getMyTeams);
router.post('/', authenticateToken, createTeam);
router.post('/join', authenticateToken, joinTeam);
router.put('/:id', authenticateToken, updateTeam);
router.delete('/:id', authenticateToken, deleteTeam);
router.post('/:id/members', authenticateToken, addMember);
router.delete('/:id/members/:userId', authenticateToken, removeMember);

// Ticket routes
router.use('/:teamId/tickets', ticketRoutes);

export default router;
