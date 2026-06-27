require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('../routes/api');
const { setupSSE } = require('../routes/sse');

const app = express();
const PORT = parseInt(process.env.PORT || '3847', 10);
const HOST = process.env.HOST || '127.0.0.1';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
  }
}));

app.use('/api', apiRoutes);
setupSSE(app);

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

function startServer() {
  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, HOST, () => {
      console.log('');
      console.log('  ╔══════════════════════════════════════════════╗');
      console.log('  ║       TRADER NEWS COCKPIT — RUNNING          ║');
      console.log(`  ║       http://${HOST}:${PORT}                 ║`);
      console.log('  ╚══════════════════════════════════════════════╝');
      console.log('');
      console.log('  Decision support only — not financial advice.');
      console.log('');
      resolve(server);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n  ERROR: Port ${PORT} is already in use.`);
        console.error('  Close the other app or set PORT=3848 in your .env file.\n');
      } else {
        console.error('\n  ERROR:', err.message, '\n');
      }
      reject(err);
    });
  });
}

if (require.main === module) {
  startServer().catch(() => process.exit(1));
}

module.exports = { app, startServer, PORT, HOST };
