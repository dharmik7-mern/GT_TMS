import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { 
    getTasks, createTask, updateTask, deleteTask, 
    addComment, uploadAttachment, getWaitingListTasks
} from '../../controllers/admin/adminCalendar.controller.js';
import { verifyToken } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(verifyToken);

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

router.get('/tasks', getTasks);
router.get('/waiting-list', getWaitingListTasks);
router.post('/tasks', createTask);
router.put('/tasks/:id', updateTask);
router.delete('/tasks/:id', deleteTask);
router.post('/tasks/:id/comments', addComment);
router.post('/tasks/:id/attachments', upload.single('file'), uploadAttachment);

export default router;
