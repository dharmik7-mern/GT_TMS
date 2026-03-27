import mongoose from 'mongoose';
import 'dotenv/config';
import Company from '../server/src/models/Company.js';
import { getTenantModels } from '../server/src/config/tenantDb.js';
import { syncProjectStats } from '../server/src/services/project.service.js';

(async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gt_pms';
    console.log(`Connecting to: ${mongoUri}`);
    await mongoose.connect(mongoUri);

    const companies = await Company.find({});
    console.log(`Found ${companies.length} companies.`);

    for (const company of companies) {
      console.log(`Processing company: ${company.name} (${company._id})`);
      const { Project, Workspace } = await getTenantModels(company._id);
      
      const workspaces = await Workspace.find({ tenantId: company._id });
      console.log(`  Found ${workspaces.length} workspaces.`);

      for (const workspace of workspaces) {
        const projects = await Project.find({ tenantId: company._id, workspaceId: workspace._id });
        console.log(`    Found ${projects.length} projects in workspace: ${workspace.name}.`);

        for (const project of projects) {
          process.stdout.write(`      Syncing project: ${project.name}... `);
          await syncProjectStats(company._id, workspace._id, project._id);
          console.log('Done.');
        }
      }
    }

    console.log('\nAll projects synchronized successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
})();
