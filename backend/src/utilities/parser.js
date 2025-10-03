export const parseTickers = (text) => {
  if (!text || typeof text !== "string") return [];

  // Match table rows explicitly
  const rows = [...text.matchAll(/\|\s*([A-Z0-9]+)\s*\|\s*([^|]+)\s*\|/g)];

  const companies = rows.map(match => {
    const ticker = match[1].trim();
    const company = match[2].trim().replace(/\s*\([^)]*\)/g, "");
    return `${company} (${ticker})`;
  });

  return [...new Set(companies)];
};
