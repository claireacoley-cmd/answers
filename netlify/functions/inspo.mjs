import { requireAuth } from '../../lib/auth.mjs';
import { json, error, readJson } from '../../lib/http.mjs';
import { listTemplates, saveTemplate, deleteTemplate } from '../../lib/store.mjs';

export default requireAuth(async (req, context) => {
  const { id } = context.params || {};

  if (req.method === 'GET') return json(await listTemplates());

  if (req.method === 'POST' || req.method === 'PUT') {
    const body = (await readJson(req)) || {};
    if (!body.name?.trim()) return error('Name is required');
    if (!body.body?.trim()) return error('Content is required');
    const t = {
      id: id || body.id,
      kind: body.kind === 'voice' ? 'voice' : 'structure',
      name: body.name.trim(),
      description: body.description || '',
      body: body.body,
      order: body.order ?? 50,
    };
    return json(await saveTemplate(t));
  }

  if (req.method === 'DELETE' && id) {
    await deleteTemplate(id);
    return json({ ok: true });
  }

  return error('Method not allowed', 405);
});

export const config = { path: ['/api/inspo', '/api/inspo/:id'] };
