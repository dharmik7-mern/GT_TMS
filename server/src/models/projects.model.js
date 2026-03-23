import mongoose from 'mongoose';

import { getProjectModel, projectSchema } from './Project.js';

// Compatibility shim for older imports. Keep all project access on the
// canonical schema/model so legacy code cannot reintroduce stale indexes.
const Project = getProjectModel(mongoose.connection);

export default Project;
export { getProjectModel, projectSchema };
