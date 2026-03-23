import AdminCalendarTask from '../../models/admin/AdminTask.model.js';

export const getTasks = async (req, res) => {
    try {
        const { start, end } = req.query;
        let query = {};
        if (start && end) {
            const startDate = new Date(start);
            const endDate = new Date(end);
            query.$and = [
                { startDateTime: { $lte: endDate } },
                { endDateTime: { $gte: startDate } }
            ];
        }
        
        // Role-based filtering
        // Note: app roles use snake_case (super_admin, team_leader, etc)
        if (req.user && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            query.$or = [
                { assignedUser: req.user.name },
                { assignedUser: String(req.user.id) }
            ];
        }

        const tasks = await AdminCalendarTask.find(query).sort({ startDateTime: 1 });
        res.status(200).json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const createTask = async (req, res) => {
    try {
        const payload = {
            ...req.body,
            tags: Array.isArray(req.body.tags) ? req.body.tags : [],
            comments: Array.isArray(req.body.comments) ? req.body.comments : [],
            attachments: Array.isArray(req.body.attachments) ? req.body.attachments : []
        };
        const task = await AdminCalendarTask.create(payload);
        res.status(201).json(task);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const task = await AdminCalendarTask.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
        res.status(200).json(task);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteTask = async (req, res) => {
    try {
        const { id } = req.params;
        await AdminCalendarTask.findByIdAndDelete(id);
        res.status(200).json({ message: "Task deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const addComment = async (req, res) => {
    try {
        const { id } = req.params;
        const task = await AdminCalendarTask.findByIdAndUpdate(
            id,
            { $push: { comments: req.body } },
            { new: true }
        );
        res.status(201).json(task);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const uploadAttachment = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.file) return res.status(400).json({ message: "No file provided" });
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        const attachment = {
            fileName: req.file.originalname,
            fileUrl: fileUrl,
            fileType: req.file.mimetype
        };
        const task = await AdminCalendarTask.findByIdAndUpdate(
            id,
            { $push: { attachments: attachment } },
            { new: true }
        );
        res.status(201).json(task);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getWaitingListTasks = async (req, res) => {
    try {
        let query = {
            $or: [
                { startDateTime: null },
                { endDateTime: null },
            ],
        };

        // Keep waiting list isolated per role (same policy as getTasks)
        if (req.user && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            query.$or = [
                { startDateTime: null },
                { endDateTime: null },
            ];
            query.assignedUser = { $in: [req.user.name, String(req.user.id)] };
        }

        const tasks = await AdminCalendarTask.find(query).sort({ createdAt: -1 });
        res.status(200).json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
