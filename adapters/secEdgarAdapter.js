const fetch = require('node-fetch');
const BaseAdapter = require('./baseAdapter');

class SecEdgarAdapter extends BaseAdapter {
  constructor() {
    super('secEdgar');
    this.baseUrl = 'https://data.sec.gov';
    this.userAgent = 'TraderNewsCockpit contact@local.dev';
  }

  isConfigured() {
    return true;
  }

  async getFilings(instrument) {
    if (!instrument.secCik) return [];

    const cik = String(instrument.secCik).replace(/^0+/, '').padStart(10, '0');
    const url = `${this.baseUrl}/submissions/CIK${cik}.json`;
    const res = await fetch(url, { headers: { 'User-Agent': this.userAgent, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`SEC EDGAR ${res.status}`);

    const data = await res.json();
    const recent = data.filings?.recent;
    if (!recent) return [];

    const forms = ['10-K', '10-Q', '8-K', 'S-1'];
    const filings = [];
    for (let i = 0; i < recent.form.length && filings.length < 10; i++) {
      const form = recent.form[i];
      if (!forms.includes(form)) continue;
      filings.push({
        form,
        filedDate: recent.filingDate[i],
        summary: `${form} filing — ${recent.primaryDocDescription[i] || 'See original document'}`,
        url: `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/, '')}/${recent.accessionNumber[i].replace(/-/g, '')}/${recent.primaryDocument[i]}`,
        accessionNumber: recent.accessionNumber[i],
        provider: 'secEdgar',
        isMock: false,
        warning: 'Automated summary — read original filing for decisions'
      });
    }
    return filings;
  }

  getStatus() {
    return { name: 'secEdgar', status: 'ready', message: 'SEC EDGAR public API (no key required)' };
  }
}

module.exports = new SecEdgarAdapter();
