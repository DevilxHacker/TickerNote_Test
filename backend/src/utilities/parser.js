export const parseTickers = (text) => {
  if (!text || typeof text !== "string") return [];

  const matches = [
    ...text.matchAll(/\|\s*([^|]+?)\s*\|/g),        // table entries
    ...text.matchAll(/\*\*([^*]+)\*\*/g),           // bold highlights
    ...text.matchAll(/\b(?:like|such as)\s+([^\.]+)/gi), // "like ..." or "such as ..."
    ...text.matchAll(/\b[A-Z]{3,}(?:[A-Z0-9]{0,4})\b/g)  // uppercase tickers (e.g., KOTAKBANK, SBIN, RELIANCE)
  ];

  const companies = matches
    .flatMap(m => (m[1] || m[0] || "")
      .split(/,\s*|and\s+/)
      .map(n => n.trim()))
    .map(n => n.replace(/\s*\([^)]*\)/g, "").trim()) // remove tickers in parentheses
    .filter(n =>
      n &&
      !/^Company Name$/i.test(n) &&
      !/^Ticker Name$/i.test(n) &&
      !/^P\/?E/i.test(n) &&
      !/^ROE/i.test(n) &&
      !/market cap/i.test(n) &&
      !/return on equity/i.test(n) &&
      !/ratios?/i.test(n) &&
      !/capitalization/i.test(n) &&
      !/frequently/i.test(n) &&
      !/fluctuations?/i.test(n) &&
      !/performance/i.test(n) &&
      !/^[-]+$/i.test(n) // ignore divider lines
    );

  return [...new Set(companies)];
};
