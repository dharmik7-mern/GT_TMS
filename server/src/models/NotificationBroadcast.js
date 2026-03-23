import mongoose from 'mongoose';

const notificationBroadcastSchema = new mongoose.Schema(
  {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetType: { type: String, enum: ['all', 'company', 'user'], required: true, index: true },
    targetLabel: { type: String, required: true, trim: true, maxlength: 200 },
    messageType: { type: String, enum: ['info', 'success', 'warning', 'urgent'], required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    reachCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

notificationBroadcastSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    ret.createdBy = String(ret.createdBy);
    ret.sentAt = ret.createdAt?.toISOString?.() || ret.createdAt;
    delete ret._id;
    delete ret.__v;
    delete ret.createdAt;
    delete ret.updatedAt;
    return ret;
  },
});

const NotificationBroadcast =
  mongoose.models.NotificationBroadcast || mongoose.model('NotificationBroadcast', notificationBroadcastSchema);

export default NotificationBroadcast;
