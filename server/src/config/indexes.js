import Company from '../models/Company.js';
import { getTenantModels } from './tenantDb.js';
import { logger } from '../utils/logger.js';

const LEGACY_PROJECT_INDEXES = ['id_1', 'workspaceId_1', 'name_1', 'workspaceId_1_name_1', 'name_1_workspaceId_1'];

function shouldDropLegacyProjectIndex(index) {
  if (!index || !index.name || index.name === '_id_') return false;
  if (LEGACY_PROJECT_INDEXES.includes(index.name)) return true;

  const keys = Object.keys(index.key || {});
  const includesNameKey = keys.includes('name');
  if (!includesNameKey) return false;

  // Old deployments may still carry unique project-name indexes.
  return Boolean(index.unique);
}

export async function alignProjectIndexes() {
  const companies = await Company.find().select('_id');

  for (const company of companies) {
    const { Project } = await getTenantModels(company._id);

    try {
      await Project.init();
    } catch (error) {
      logger.warn('project_init_failed', { companyId: String(company._id), message: error?.message });
    }

    let existingIndexes = [];
    try {
      existingIndexes = await Project.collection.indexes();
    } catch (error) {
      logger.warn('project_indexes_list_failed', { companyId: String(company._id), message: error?.message });
      continue;
    }

    for (const index of existingIndexes) {
      if (!shouldDropLegacyProjectIndex(index)) continue;
      try {
        await Project.collection.dropIndex(index.name);
        logger.info('project_legacy_index_dropped', { companyId: String(company._id), indexName: index.name });
      } catch (error) {
        logger.warn('project_legacy_index_drop_failed', {
          companyId: String(company._id),
          indexName: index.name,
          message: error?.message,
        });
      }
    }

    try {
      await Project.syncIndexes();
    } catch (error) {
      logger.warn('project_sync_indexes_failed', { companyId: String(company._id), message: error?.message });
    }
  }
}
