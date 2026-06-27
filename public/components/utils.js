/* Trader News Cockpit — utilities */
window.TNC = window.TNC || {};

TNC.API = '/api';

TNC.fetchJSON = async function(path, options = {}) {
  const res = await fetch(TNC.API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'HTTP ' + res.status);
  }
  return res.json();
};

TNC.formatPrice = function(price, symbol) {
  if (price == null) return '—';
  if (symbol && symbol.includes('/')) return price.toFixed(symbol.includes('BTC') ? 0 : 4);
  return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

TNC.formatPercent = function(val) {
  if (val == null) return '—';
  return (val >= 0 ? '+' : '') + val.toFixed(2) + '%';
};

TNC.formatDate = function(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

TNC.formatCountdown = function(ms) {
  if (ms == null || ms < 0) return 'Past';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 48) return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
  return h + 'h ' + m + 'm';
};

TNC.marketReadClass = function(read) {
  const r = (read || '').toLowerCase();
  if (r.includes('bullish')) return 'bullish';
  if (r.includes('bearish')) return 'bearish';
  if (r.includes('event')) return 'event';
  return 'neutral';
};

TNC.showToast = function(message, type) {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'warning' ? ' warning' : '');
  el.textContent = message;
  container.appendChild(el);
  setTimeout(function() { el.remove(); }, 5000);
};

TNC.escapeHtml = function(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
};

TNC.renderNewsItem = function(item) {
  const sent = (item.sentiment && item.sentiment.label) || 'neutral';
  const cred = item.sourceCredibility || {};
  return '<article class="news-item ' + sent + '">' +
    '<div class="news-headline"><a href="' + TNC.escapeHtml(item.url) + '" target="_blank" rel="noopener">' + TNC.escapeHtml(item.headline) + '</a></div>' +
    '<div class="news-meta"><span>' + TNC.escapeHtml(item.source) + '</span><span>' + TNC.formatDate(item.publishedAt) + '</span>' +
    '<span class="sentiment-label ' + sent + '">' + sent + '</span>' +
    '<span class="badge ' + (cred.badge || 'red') + '">' + (cred.credibilityScore != null ? cred.credibilityScore : '?') + ' cred</span>' +
    '<span>' + (item.marketImpact || 'Low') + ' impact</span><span>' + (item.timeSensitivity || '') + '</span>' +
    '<span>' + (item.relevanceScore != null ? item.relevanceScore : 0) + '% relevant</span></div>' +
    '<div class="news-summary">' + TNC.escapeHtml(item.summary) + '</div>' +
    (item.sentiment && item.sentiment.reason ? '<div class="news-summary"><em>' + TNC.escapeHtml(item.sentiment.reason) + '</em></div>' : '') +
    (cred.biasWarning ? '<div class="news-summary" style="color:var(--amber)">' + TNC.escapeHtml(cred.biasWarning) + '</div>' : '') +
    '<div class="news-tags">' + (item.tags || []).map(function(t) { return '<span class="tag">' + TNC.escapeHtml(t) + '</span>'; }).join('') + '</div></article>';
};

TNC.renderEventItem = function(e) {
  return '<div class="event-item"><div class="event-date">' + TNC.formatDate(e.dateTime) + '</div><div><strong>' +
    TNC.escapeHtml(e.eventName) + '</strong><div style="font-size:0.8rem;color:var(--text-secondary);margin-top:0.25rem">' +
    TNC.escapeHtml(e.whyItMatters || e.description || '') + '</div>' +
    (e.country ? '<div style="font-size:0.75rem;color:var(--text-muted)">' + TNC.escapeHtml(e.country) + '</div>' : '') +
    '</div><div><span class="event-impact ' + (e.expectedImpact || 'Medium') + '">' + (e.expectedImpact || 'Medium') +
    '</span><div class="countdown">' + TNC.formatCountdown(e.countdownMs) + '</div></div></div>';
};
