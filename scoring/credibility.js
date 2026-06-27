const { getSourceCredibility } = require('../server/configLoader');

function extractDomain(url) {
  if (!url) return 'unknown';
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host;
  } catch {
    return 'unknown';
  }
}

function getCredibilityForSource(sourceName, url) {
  const config = getSourceCredibility();
  const domain = extractDomain(url);
  const nameLower = (sourceName || '').toLowerCase();

  let match = config.sources.find(s =>
    s.domain !== 'unknown' && (domain.includes(s.domain) || s.domain.includes(domain))
  );

  if (!match) {
    match = config.sources.find(s =>
      nameLower.includes(s.sourceName.toLowerCase()) ||
      s.sourceName.toLowerCase().includes(nameLower)
    );
  }

  if (!match) {
    match = config.sources.find(s => s.sourceName === 'Unknown');
  }

  let badge = 'red';
  if (match.credibilityScore >= 80) badge = 'green';
  else if (match.credibilityScore >= 60) badge = 'amber';
  else if (match.sourceType === 'official_company' || match.sourceType === 'regulator') badge = 'blue';

  return {
    sourceName: match.sourceName,
    domain: domain,
    sourceType: match.sourceType,
    credibilityScore: match.credibilityScore,
    biasRisk: match.biasRisk,
    knownSlant: match.knownSlant,
    includeInDecision: match.includeInDecision,
    badge,
    biasWarning: match.biasRisk === 'high' || match.knownSlant === 'official/promotional' || match.knownSlant === 'sponsored'
      ? `Caution: ${match.knownSlant} bias (${match.biasRisk} risk)`
      : null,
    notes: match.notes
  };
}

module.exports = { getCredibilityForSource, extractDomain };
