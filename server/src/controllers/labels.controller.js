import { getTenantModels } from '../config/tenantDb.js';

export async function list(req, res, next) {
  try {
    const { companyId, workspaceId } = req.auth;
    const { Label } = await getTenantModels(companyId);
    
    const query = { tenantId: companyId };
    if (workspaceId) {
      query.workspaceId = workspaceId;
    }

    const labels = await Label.find(query).sort({ name: 1 });
    return res.status(200).json({ success: true, data: labels });
  } catch (e) {
    return next(e);
  }
}

export async function create(req, res, next) {
  try {
    const { companyId, workspaceId } = req.auth;
    const { name, color } = req.body;
    
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: { message: 'Label name is required' } });
    }
    if (!workspaceId) {
      return res.status(400).json({ success: false, error: { message: 'Workspace context is required to create labels' } });
    }

    const { Label } = await getTenantModels(companyId);
    
    // Safety: check if label with same name exists in workspace
    const existing = await Label.findOne({ tenantId: companyId, workspaceId, name: name.trim() });
    if (existing) {
      return res.status(400).json({ success: false, error: { message: 'Label with this name already exists' } });
    }

    const label = await Label.create({
      tenantId: companyId,
      workspaceId,
      name: name.trim(),
      color: color || '#71717a',
    });
    res.status(201).json({ success: true, data: label });
  } catch (e) {
    console.error(`[LabelsController] Error creating label:`, e);
    return next(e);
  }
}

export async function remove(req, res, next) {
  try {
    const { companyId, workspaceId } = req.auth;
    const { id } = req.params;
    const { Label, Task } = await getTenantModels(companyId);

    const label = await Label.findOneAndDelete({ _id: id, tenantId: companyId, workspaceId });
    if (!label) {
      return res.status(404).json({ success: false, error: { message: 'Label not found' } });
    }

    // Optional: remove this label from all tasks safely
    await Task.updateMany(
      { tenantId: companyId, workspaceId, labels: id },
      { $pull: { labels: id } }
    );

    return res.status(200).json({ success: true, data: { ok: true } });
  } catch (e) {
    return next(e);
  }
}
