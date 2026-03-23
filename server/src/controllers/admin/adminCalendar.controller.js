import AdminCalendarTask from '../../models/admin/AdminTask.model.js';
import AdminNotification from '../../models/admin/AdminNotification.model.js';
import User from '../../models/user.model.js';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Look up user id by name (best-effort) */
const findUserIdByName = async (name) => {
    if (!name) return null;
    const user = await User.findOne({ name }).select('_id').lean();
    return user ? String(user._id) : name; // fallback: use name as userId string
};

/** Create a notification record for one participant */
const createNotif = async ({ userId, title, message, type = 'task', link }) => {
    try {
        await AdminNotification.create({ userId, title, message, type, link });
    } catch (e) {
        console.error('[Notif] failed to create notification:', e.message);
    }
};

// ─── controllers ────────────────────────────────────────────────────────────

export const getTasks = async (req, res) => {
    try {
        const { start, end } = req.query;
        let query = {};
        if (start && end) {
            const startDate = new Date(start);
            const endDate   = new Date(end);
            query.$and = [
                { startDateTime: { $lte: endDate } },
                { endDateTime:   { $gte: startDate } },
            ];
        }

        // Role-based filtering
        if (req.user && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            query.$or = [
                { assignedUser: req.user.name },
                { assignedUser: String(req.user.id) },
                { participants: { $in: [req.user.name, String(req.user.id)] } },
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
            tags:        Array.isArray(req.body.tags)        ? req.body.tags        : [],
            comments:    Array.isArray(req.body.comments)    ? req.body.comments    : [],
            attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [],
            participants: Array.isArray(req.body.participants) ? req.body.participants : [],
        };

        const task = await AdminCalendarTask.create(payload);

        // ── Notify every participant ──────────────────────────────────────
        const allRecipients = Array.from(new Set([
            ...(payload.participants || []),
            payload.assignedUser,
        ].filter(Boolean)));

        const eventDate = task.startDateTime
            ? new Date(task.startDateTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
            : 'TBD';

        for (const name of allRecipients) {
            const userId = await findUserIdByName(name);
            if (!userId) continue;
            await createNotif({
                userId,
                title:   `📅 New event: ${task.title}`,
                message: `You have been added to "${task.title}" on ${eventDate}.`,
                type:    'task',
                link:    `/calendar`,
            });
        }

        res.status(201).json(task);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const task = await AdminCalendarTask.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });

        // If participants changed, notify new ones
        if (req.body.participants && Array.isArray(req.body.participants)) {
            for (const name of req.body.participants) {
                const userId = await findUserIdByName(name);
                if (!userId) continue;
                await createNotif({
                    userId,
                    title:   `📝 Event updated: ${task.title}`,
                    message: `The event "${task.title}" has been updated.`,
                    type:    'task',
                    link:    `/calendar`,
                });
            }
        }

        res.status(200).json(task);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteTask = async (req, res) => {
    try {
        const { id } = req.params;
        await AdminCalendarTask.findByIdAndDelete(id);
        res.status(200).json({ message: 'Task deleted successfully' });
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
        if (!req.file) return res.status(400).json({ message: 'No file provided' });
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        const attachment = { fileName: req.file.originalname, fileUrl, fileType: req.file.mimetype };
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
        let query = { $or: [{ startDateTime: null }, { endDateTime: null }] };
        if (req.user && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            query.assignedUser = { $in: [req.user.name, String(req.user.id)] };
        }
        const tasks = await AdminCalendarTask.find(query).sort({ createdAt: -1 });
        res.status(200).json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * GET /admin/calendar/due-reminders
 * Returns tasks whose reminderAt is within the next 60 seconds (for client polling).
 */
export const getDueReminders = async (req, res) => {
    try {
        const now  = new Date();
        const soon = new Date(now.getTime() + 60_000); // 60 s window
        const tasks = await AdminCalendarTask.find({
            reminderAt: { $gte: now, $lte: soon },
        }).lean();
        res.status(200).json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
