const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      const done = await kv.get('done-tasks') || {};
      res.status(200).json(done);
      return;
    }

    if (req.method === 'POST') {
      const { id, value } = req.body;
      if (!id) {
        res.status(400).json({ error: 'Missing id' });
        return;
      }
      const done = await kv.get('done-tasks') || {};
      done[id] = value;
      await kv.set('done-tasks', done);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
