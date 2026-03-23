import mongoose from 'mongoose';
import { getUserModel } from './User.js';

/**
 * Legacy import path used by admin controllers.
 * Must use the same Mongoose model as the rest of the app (User.js) — registering
 * a second "User" schema here was overwriting passwordHash/super_admin and broke seed/auth.
 */
const User = getUserModel(mongoose.connection);
export default User;
