import express from 'express';
import { 
    createProject, 
    getAllProjects, 
    updateProject, 
    deleteProject 
} from '../controllers/projects.controllers.js';

const router = express.Router();

router.get('/', getAllProjects);
router.post('/create', createProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

export default router;