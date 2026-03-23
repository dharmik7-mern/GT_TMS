import Project from '../models/projects.model.js'
import AdminConversation from '../models/admin/AdminConversation.model.js';

export const createProject = async (req, res) => {
    try {
        const { name, id, members } = req.body;
        if (!name || !id) {
            return res.status(400).json({ message: "Name and ID are required" });
        }
        const project = await Project.create(req.body);

        // Automatically create a group chat for the project team
        if (members && Array.isArray(members) && members.length > 0) {
            const groupChat = new AdminConversation({
                participants: members, // IDs of team members
                isGroup: true,
                groupName: `${name} (Project)`,
                projectId: project._id,
                groupType: 'project',
                department: project.department || 'General'
            });
            await groupChat.save();
            project.chatId = groupChat._id;
            await project.save();
        }

        res.status(201).json(project);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

export const getAllProjects = async (req, res) => {
    try {
        const projects = await Project.find().sort({ creationDate: -1 });
        res.status(200).json(projects);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

export const updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        const project = await Project.findOneAndUpdate({ id }, req.body, { new: true });
        if (!project) return res.status(404).json({ message: "Project not found" });

        // Update the associated group chat if it exists
        if (project.chatId) {
            const updateData = {};
            if (req.body.name) updateData.groupName = `${req.body.name} (Project)`;
            if (req.body.members) updateData.participants = req.body.members;

            if (Object.keys(updateData).length > 0) {
                await AdminConversation.findByIdAndUpdate(project.chatId, updateData);
            }
        }

        res.status(200).json(project);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

export const deleteProject = async (req, res) => {
    try {
        const { id } = req.params;
        const project = await Project.findOneAndDelete({ id });
        if (!project) return res.status(404).json({ message: "Project not found" });

        if (project.chatId) {
            await AdminConversation.findByIdAndDelete(project.chatId);
        }

        res.status(200).json({ message: "Project deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}