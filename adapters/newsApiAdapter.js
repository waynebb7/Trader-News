const fetch = require('node-fetch');
const BaseAdapter = require('./baseAdapter');

class NewsApiAdapter extends BaseAdapter {
  constructor() {
    super('newsApi');
    this.apiKey = process.env.NEWS_API_KEY || '';
    this.baseUrl = 'https://newsapi.org/v2';
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async getNews(instrument) {
    const q = encodeURIComponent(`${instrument.displayName} OR ${instrument.symbol}`);
    const url = `${this.baseUrl}/everything?q=${q}&sortBy=publishedAt&pageSize=20&language=en&apiKey=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`NewsAPI ${res.status}`);
    const data = await res.json();
    if (data.status === 'error') throw new Error(data.message);

    return (data.articles || []).map((a, i) => ({
      id: `newsapi-${i}`,
      headline: a.title,
      source: a.source?.name || 'Unknown',
      url: a.url,
      summary: a.description || '',
      publishedAt: a.publishedAt,
      provider: 'newsApi'
    }));
  }
}

module.exports = new NewsApiAdapter();
