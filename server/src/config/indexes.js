import { getTenantModels } from './tenantDb.js';
import { logger } from '../utils/logger.js';

const LEGACY_PROJECT_INDEXES = ['id_1', 'workspaceId_1', 'name_1'];

export async function alignProjectIndexes() {
  const { Project } = getTenantModels();

  try {
    await Project.init();
  } catch (error) {
    logger.warn('project_init_failed', { message: error?.message });
  }

  let existingIndexes = [];
  try {
    existingIndexes = await Project.collection.indexes();
  } catch (error) {
    logger.warn('project_indexes_list_failed', { message: error?.message });
    return;
  }

  for (const indexName of LEGACY_PROJECT_INDEXES) {
    const hasIndex = existingIndexes.some((index) => index.name === indexName);
    if (!hasIndex) continue;

    try {
      await Project.collection.dropIndex(indexName);
      logger.info('project_legacy_index_dropped', { indexName });
    } catch (error) {
      logger.warn('project_legacy_index_drop_failed', {
        indexName,
        message: error?.message,
      });
    }
  }

  try {
    await Project.syncIndexes();
  } catch (error) {
    logger.warn('project_sync_indexes_failed', { message: error?.message });
  }
}
