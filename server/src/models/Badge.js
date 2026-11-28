import mongoose from 'mongoose';

/** A scout badge given to a member: a short word (e.g. "Leadership") and an optional reason. */
const badgeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 30 },
    reason: { type: String, trim: true, maxlength: 120, default: '' },
    givenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: 'givenAt', updatedAt: false } }
);

export const Badge = mongoose.model('Badge', badgeSchema);
