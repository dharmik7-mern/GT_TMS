import mongoose from 'mongoose';

const timelineTaskSchema = new mongoose.Schema({
  id: { type: String, required: true },
  taskName: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  duration: { type: Number, required: true },
  assignedRole: { type: String },
  dependencyTaskId: { type: String },
  progress: { type: Number, default: 0 },
  status: { type: String, default: 'pending' },
}, { _id: false });

const projectTimelineSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, unique: true },
  tasks: [timelineTaskSchema],
  status: { type: String, enum: ['Draft', 'Approved'], default: 'Draft' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export function getProjectTimelineModel(conn) {
  return conn.models.ProjectTimeline || conn.model('ProjectTimeline', projectTimelineSchema);
}

export { projectTimelineSchema };

