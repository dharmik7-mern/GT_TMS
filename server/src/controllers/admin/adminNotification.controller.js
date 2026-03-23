import AdminNotification from '../../models/admin/AdminNotification.model.js';

export const getNotifications = async (req, res) => {
    try {
        const { userId } = req.query; // Normally from req.user.id with auth
        const query = userId ? { userId } : {};
        const notifications = await AdminNotification.find(query).sort({ createdAt: -1 });
        res.status(200).json(notifications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        await AdminNotification.findByIdAndUpdate(id, { isRead: true });
        res.status(200).json({ message: "Notification marked as read" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const createNotification = async (req, res) => {
    try {
        const notif = await AdminNotification.create(req.body);
        res.status(201).json(notif);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const clearNotifications = async (req, res) => {
    try {
        const { userId } = req.query;
        await AdminNotification.deleteMany({ userId });
        res.status(200).json({ message: "Notifications cleared" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
