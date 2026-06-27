const fetch = require('node-fetch');
const BaseAdapter = require('./baseAdapter');
const mockAdapter = require('./mockAdapter');
const { getManualPoliticalEvents } = require('../db/database');

class PoliticalEventsAdapter extends BaseAdapter {
  constructor() {
    super('politicalEvents');
  }

  isConfigured() {
    return true;
  }

  async getPoliticalEvents() {
    const manual = getManualPoliticalEvents();
    let official = [];

    try {
      official = await this.fetchWhiteHouseBriefings();
    } catch {
      official = [];
    }

    const combined = [...manual, ...official];
    if (!combined.length) {
      return mockAdapter.getPoliticalEvents();
    }

    const now = new Date();
    return combined.map(e => {
      const dt = new Date(e.dateTime);
      return {
        ...e,
        isToday: dt.toDateString() === now.toDateString(),
        countdownMs: dt - now,
        provider: e.provider || 'politicalEvents'
      };
    });
  }

  async fetchWhiteHouseBriefings() {
    const events = [];
    try {
      const res = await fetch('https://www.whitehouse.gov/briefings-statements/', {
        headers: { 'User-Agent': 'TraderNewsCockpit/1.0' },
        timeout: 8000
      });
      if (!res.ok) return events;
      const html = await res.text();
      const titleMatches = html.match(/briefing[^<]{0,80}/gi) || [];
      for (let i = 0; i < Math.min(3, titleMatches.length); i++) {
        events.push({
          id: `wh-${i}`,
          eventName: titleMatches[i].trim().slice(0, 120) || 'White House Briefing',
          dateTime: new Date().toISOString(),
          source: 'White House',
          status: 'unknown',
          relevanceTags: ['political', 'defence', 'tariff'],
          description: 'Parsed from White House briefings page — verify schedule on whitehouse.gov',
          provider: 'politicalEvents'
        });
      }
    } catch {
      // Graceful fallback
    }
    return events;
  }

  getStatus() {
    return { name: 'politicalEvents', status: 'ready', message: 'White House feed + manual events' };
  }
}

module.exports = new PoliticalEventsAdapter();
