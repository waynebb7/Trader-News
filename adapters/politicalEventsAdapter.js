const fetch = require('node-fetch');
const BaseAdapter = require('./baseAdapter');
const mockAdapter = require('./mockAdapter');
const { getManualPoliticalEvents } = require('../db/database');

class PoliticalEventsAdapter extends BaseAdapter {
  constructor() {
    super('politicalEvents');
  }

  decodeHtmlEntities(text) {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  sanitizeTitle(text) {
    const stripped = this.decodeHtmlEntities(
      String(text || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    );

    // Filter out malformed fragments and archive labels that are not events.
    if (!stripped) return '';
    if (/^https?:\/\//i.test(stripped)) return '';
    if (/\/>|href=|page\/\d+/i.test(stripped)) return '';
    if (/archives?/i.test(stripped)) return '';

    return stripped.slice(0, 120);
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
      const titleMatches = [...html.matchAll(/<a[^>]*href="[^"]*briefings-statements[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)]
        .map(m => this.sanitizeTitle(m[1]))
        .filter(Boolean)
        .filter((title, idx, all) => all.indexOf(title) === idx);

      for (let i = 0; i < Math.min(3, titleMatches.length); i++) {
        events.push({
          id: `wh-${i}`,
          eventName: titleMatches[i] || 'White House Briefing',
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
