import mongoose from 'mongoose';

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    status: { type: String, enum: ['active', 'trial', 'suspended'], default: 'active' },
    color: { type: String, trim: true, maxlength: 32 },
  },
  { timestamps: true }
);

companySchema.index({ email: 1 }, { unique: true });

companySchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const Company = mongoose.model('Company', companySchema);
export default Company;

