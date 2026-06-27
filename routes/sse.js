const { getAllInstruments, findInstrument } = require('../server/configLoader');
const { getDashboardData } = require('../services/orchestrator');

const clients = new Set();
let broadcastInterval = null;

function setupSSE(app) {
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const client = { res, symbol: req.query.symbol };
    clients.add(client);

    res.write(`data: ${JSON.stringify({ type: 'connected', time: new Date().toISOString() })}\n\n`);

    req.on('close', () => clients.delete(client));
  });

  if (!broadcastInterval) {
    broadcastInterval = setInterval(async () => {
      for (const client of clients) {
        try {
          if (!client.symbol) continue;
          const instrument = findInstrument(client.symbol);
          if (!instrument) continue;
          const data = await getDashboardData(instrument);
          client.res.write(`data: ${JSON.stringify({ type: 'update', payload: {
            quote: data.quote,
            decision: data.decision,
            alerts: data.alerts,
            meta: data.meta
          }})}\n\n`);
        } catch {
          // Skip failed client updates
        }
      }
    }, 30000);
  }
}

function notifyClients(event) {
  for (const client of clients) {
    try {
      client.res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      clients.delete(client);
    }
  }
}

module.exports = { setupSSE, notifyClients };
