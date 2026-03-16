import { Router } from 'express';
import {
  createPersonalTicket,
  getPersonalTickets,
  updatePersonalTicket,
  deletePersonalTicket,
} from '../controllers/personalTicketController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticateToken);

router.post('/', createPersonalTicket);
router.get('/', getPersonalTickets);
router.put('/:ticketId', updatePersonalTicket);
router.delete('/:ticketId', deletePersonalTicket);

export default router;
