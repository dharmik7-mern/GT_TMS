import AdminCalendarTask from '../../models/admin/AdminTask.model.js';
import User from '../../models/user.model.js';
import Project from '../../models/projects.model.js';

export const getDashboardStats = async (req, res) => {
    try {
        const totalProjects = await Project.countDocuments();
        const activeProjects = await Project.countDocuments({ status: 'active' });
        
        const totalTasks = await AdminCalendarTask.countDocuments();
        const completedTasks = await AdminCalendarTask.countDocuments({ status: 'Done' });
        const pendingTasks = await AdminCalendarTask.countDocuments({ status: 'Pending' });
        
        const totalUsers = await User.countDocuments();
        const teamLeaders = await User.countDocuments({ role: 'team_leader' });
        
        // Activity stats (simplified)
        const recentTasks = await AdminCalendarTask.find()
            .sort({ createdAt: -1 })
            .limit(5);

        res.status(200).json({
            stats: {
                totalProjects,
                activeProjects,
                totalTasks,
                completedTasks,
                pendingTasks,
                totalUsers,
                teamLeaders
            },
            recentActivity: recentTasks
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getRecentActivity = async (req, res) => {
    try {
        const activities = await AdminCalendarTask.find()
            .sort({ updatedAt: -1 })
            .limit(10)
            .select('title status updatedAt');
            
        res.status(200).json(activities);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
