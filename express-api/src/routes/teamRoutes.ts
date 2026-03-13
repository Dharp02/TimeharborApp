import { Router } from 'express';
import { createTeam, joinTeam, getMyTeams, updateTeam, deleteTeam, addMember, removeMember, updateMemberRole, getTeamActivity } from '../controllers/teamController';
import { getActivities, syncActivities } from '../controllers/activityLogController';
import ticketRoutes from './ticketRoutes';
import pulseRoutes from './pulseRoutes';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/', authenticateToken, getMyTeams);
router.post('/', authenticateToken, createTeam);
router.post('/join', authenticateToken, joinTeam);
router.put('/:id', authenticateToken, updateTeam);
router.delete('/:id', authenticateToken, deleteTeam);
router.post('/:id/members', authenticateToken, addMember);
router.delete('/:id/members/:userId', authenticateToken, removeMember);
router.put('/:id/members/:userId/role', authenticateToken, updateMemberRole);
router.get('/:id/activity', authenticateToken, getTeamActivity); // Old method? Or replace? 
// Let's keep new endpoints separate for clarity or replace existing if unused.
// getTeamActivity was likely for "TeamActivityReport".
// Let's add new endpoints for log syncing.
router.get('/:teamId/logs', authenticateToken, getActivities);
router.post('/:teamId/logs/sync', authenticateToken, syncActivities);

// Ticket routes
router.use('/:teamId/tickets', ticketRoutes);

// Pulse attachment routes nested under a specific ticket
router.use('/:teamId/tickets/:ticketId/pulse', pulseRoutes);

export default router;
