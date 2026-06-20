const webpush = require('web-push');
const { kv } = require('@vercel/kv');
const properties = require('../properties.json');

webpush.setVapidDetails(
  'mailto:ops@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const TZ = 'America/Mexico_City';

function parseICS(text) {
  const events = [];
  const blocks = text.split('BEGIN:VEVENT').slice(1);
  for (const block of blocks) {
    const get = (key) => {
      const m = block.match(new RegExp(key + '[^:]*:(.*)'));
      return m ? m[1].trim() : '';
    };
    const dtstart = get('DTSTART');
    const dtend = get('DTEND');
    if (!dtstart || !dtend) continue;
    events.push({ start: dtstart.slice(0, 8), end: dtend.slice(0, 8) });
  }
  return events;
}

function fmtDate(yyyymmdd) {
  return yyyymmdd.slice(0, 4) + '-' + yyyymmdd.slice(4, 6) + '-' + yyyymmdd.slice(6, 8);
}

function todayCDMX() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const map = {};
  parts.forEach(p => map[p.type] = p.value);
  return `${map.year}-${map.month}-${map.day}`;
}

async function fetchOne(prop) {
  try {
    const r = await fetch(prop.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OpsDashboard/1.0)' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const text = await r.text();
    return { name: prop.name, owner: prop.owner, ok: true, events: parseICS(text) };
  } catch (e) {
    return { name: prop.name, owner: prop.owner, ok: false, events: [] };
  }
}

module.exports = async (req, res) => {
  const secret = req.query.secret || (req.headers['x-cron-secret']);
  if (secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const subscription = await kv.get('push-subscription');
    if (!subscription) {
      res.status(200).json({ ok: true, sent: 0, note: 'No hay suscripción push registrada todavía' });
      return;
    }

    const done = await kv.get('done-tasks') || {};
    const today = todayCDMX();

    const results = await Promise.all(properties.map(fetchOne));

    const pendingIn = [];
    const pendingOut = [];

    results.forEach(p => {
      if (!p.ok) return;
      p.events.forEach(ev => {
        const startDate = fmtDate(ev.start);
        const endDate = fmtDate(ev.end);
        if (startDate === today) {
          const id = p.name + '-in-' + ev.start;
          if (!done[id]) pendingIn.push({ id, prop: p.name });
        }
        if (endDate === today) {
          const id = p.name + '-out-' + ev.end;
          if (!done[id]) pendingOut.push({ id, prop: p.name });
        }
      });
    });

    const notifications = [
      ...pendingIn.map(t => ({ title: '🛎️ Llegada pendiente', body: t.prop + ' — Atención al cliente', tag: t.id })),
      ...pendingOut.map(t => ({ title: '🧹 Salida pendiente', body: t.prop + ' — Programar limpieza', tag: t.id }))
    ];

    let sent = 0;
    const errors = [];
    for (const n of notifications) {
      try {
        await webpush.sendNotification(subscription, JSON.stringify(n));
        sent++;
      } catch (e) {
        errors.push(e.message);
      }
    }

    res.status(200).json({ ok: true, sent, totalPending: notifications.length, errors });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
