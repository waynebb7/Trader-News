const path = require('path');
const fs = require('fs');

function loadJson(relativePath) {
  const full = path.join(__dirname, '..', relativePath);
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function saveJson(relativePath, data) {
  const full = path.join(__dirname, '..', relativePath);
  fs.writeFileSync(full, JSON.stringify(data, null, 2), 'utf8');
}

function getInstrumentsConfig() {
  return loadJson('config/instruments.json');
}

function saveInstrumentsConfig(config) {
  saveJson('config/instruments.json', config);
}

function getSourceCredibility() {
  return loadJson('config/sourceCredibility.json');
}

function getSectorRules() {
  return loadJson('config/sectorRules.json');
}

function getEventRules() {
  return loadJson('config/eventRules.json');
}

function getApiProviders() {
  return loadJson('config/apiProviders.json');
}

function getAllInstruments() {
  const base = getInstrumentsConfig();
  const { getCustomInstruments } = require('../db/database');
  const custom = getCustomInstruments();
  return [...base.instruments, ...custom];
}

function findInstrument(symbolOrId) {
  const all = getAllInstruments();
  const q = String(symbolOrId).toLowerCase();
  return all.find(i =>
    i.symbol.toLowerCase() === q ||
    i.id.toLowerCase() === q ||
    i.displayName.toLowerCase().includes(q)
  );
}

module.exports = {
  loadJson,
  saveJson,
  getInstrumentsConfig,
  saveInstrumentsConfig,
  getSourceCredibility,
  getSectorRules,
  getEventRules,
  getApiProviders,
  getAllInstruments,
  findInstrument
};
