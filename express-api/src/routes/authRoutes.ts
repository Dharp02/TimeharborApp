import { Router } from 'express';
import { signup, signin, getMe } from '../controllers/authController';

const router = Router();

router.post('/signup', signup);
router.post('/signin', signin);
router.get('/me', getMe);

export default router;
