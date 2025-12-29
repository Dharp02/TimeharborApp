import { Router } from 'express';
import { createTicket, getTickets, updateTicket, deleteTicket } from '../controllers/ticketController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router({ mergeParams: true });

// All ticket routes require authentication
router.use(authenticateToken);

router.post('/', createTicket);
router.get('/', getTickets);
router.put('/:ticketId', updateTicket);
router.delete('/:ticketId', deleteTicket);

export default router;
