import mongoose from 'mongoose';
import { getPersonalTaskModel } from '../models/PersonalTask.js';

export async function list(req, res, next) {
  try {
    const { sub: userId } = req.auth;
    const PersonalTask = getPersonalTaskModel(mongoose.connection);
    
    const tasks = await PersonalTask.find({ userId }).sort({ isPinned: -1, order: 1, createdAt: -1 });
    return res.status(200).json({ success: true, data: tasks });
  } catch (e) {
    return next(e);
  }
}

export async function create(req, res, next) {
  try {
    const { sub: userId, companyId } = req.auth;
    const PersonalTask = getPersonalTaskModel(mongoose.connection);
    
    const task = new PersonalTask({
      ...req.body,
      userId,
      tenantId: companyId,
    });
    
    await task.save();
    return res.status(201).json({ success: true, data: task });
  } catch (e) {
    return next(e);
  }
}

export async function update(req, res, next) {
  try {
    const { sub: userId } = req.auth;
    const { id } = req.params;
    const PersonalTask = getPersonalTaskModel(mongoose.connection);
    
    const task = await PersonalTask.findOneAndUpdate(
      { _id: id, userId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    
    if (!task) {
      return res.status(404).json({ success: false, error: { message: 'Task not found' } });
    }
    
    return res.status(200).json({ success: true, data: task });
  } catch (e) {
    return next(e);
  }
}

export async function remove(req, res, next) {
  try {
    const { sub: userId } = req.auth;
    const { id } = req.params;
    const PersonalTask = getPersonalTaskModel(mongoose.connection);
    
    const task = await PersonalTask.findOneAndDelete({ _id: id, userId });
    
    if (!task) {
      return res.status(404).json({ success: false, error: { message: 'Task not found' } });
    }
    
    return res.status(200).json({ success: true, data: { ok: true } });
  } catch (e) {
    return next(e);
  }
}

export async function togglePinned(req, res, next) {
  try {
    const { sub: userId } = req.auth;
    const { id } = req.params;
    const PersonalTask = getPersonalTaskModel(mongoose.connection);
    
    const task = await PersonalTask.findOne({ _id: id, userId });
    if (!task) return res.status(404).json({ success: false, error: { message: 'Task not found' } });
    
    task.isPinned = !task.isPinned;
    await task.save();
    
    return res.status(200).json({ success: true, data: task });
  } catch (e) {
    return next(e);
  }
}

export async function stats(req, res, next) {
  try {
    const { sub: userId } = req.auth;
    const PersonalTask = getPersonalTaskModel(mongoose.connection);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const totalCount = await PersonalTask.countDocuments({ userId });
    const completedCount = await PersonalTask.countDocuments({ userId, status: 'done' });
    const completedToday = await PersonalTask.countDocuments({ 
      userId, 
      status: 'done', 
      completedAt: { $gte: today } 
    });
    
    // Simple streak calculation (mock or basic logic)
    // For now just return basics
    return res.status(200).json({ 
      success: true, 
      data: { 
        total: totalCount, 
        completed: completedCount, 
        completedToday,
        streak: 5 // Mock streak for UI design
      } 
    });
  } catch (e) {
    return next(e);
  }
}
