const properties = require('../properties.json');

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
    let summary = get('SUMMARY').replace(/\\,/g, ',').replace(/\\n/g, ' ');
    if (!dtstart || !dtend) continue;
    events.push({
      start: dtstart.slice(0, 8),
      end: dtend.slice(0, 8),
      summary
    });
  }
  return events;
}

function fmtDate(yyyymmdd) {
  return yyyymmdd.slice(0, 4) + '-' + yyyymmdd.slice(4, 6) + '-' + yyyymmdd.slice(6, 8);
}

async function fetchOne(prop) {
  try {
    const res = await fetch(prop.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OpsDashboard/1.0)' }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    const events = parseICS(text).map(ev => ({
      ...ev,
      startDate: fmtDate(ev.start),
      endDate: fmtDate(ev.end)
    }));
    return { name: prop.name, owner: prop.owner, ok: true, events };
  } catch (e) {
    return { name: prop.name, owner: prop.owner, ok: false, error: e.message, events: [] };
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  try {
    const results = await Promise.all(properties.map(fetchOne));
    res.status(200).json({
      syncedAt: new Date().toISOString(),
      properties: results
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
