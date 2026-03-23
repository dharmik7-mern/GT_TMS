import mongoose from 'mongoose';

const authLookupSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  },
  { timestamps: true }
);

authLookupSchema.index({ email: 1 }, { unique: true });

authLookupSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    ret.tenantId = String(ret.tenantId);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const AuthLookup = mongoose.models.AuthLookup || mongoose.model('AuthLookup', authLookupSchema);
export default AuthLookup;

