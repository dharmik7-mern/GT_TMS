import express from 'express';

import { validateBody } from '../../../middleware/validate.middleware.js';
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from '../../../validations/auth.validation.js';
import * as AuthController from '../../../controllers/auth.controller.js';

const router = express.Router();

router.post('/register', validateBody(registerSchema), AuthController.register);
router.post('/login', validateBody(loginSchema), AuthController.login);
router.post('/refresh', validateBody(refreshSchema), AuthController.refresh);
router.post('/logout', validateBody(logoutSchema), AuthController.logout);

export default router;

