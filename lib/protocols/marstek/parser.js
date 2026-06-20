// lib/marstek/parser.js
function parseKeyValuePayload(payload) {
  return String(payload)
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
    .reduce((result, part) => {
      const index = part.indexOf('=');
      if (index < 0) return result;

      const key = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();

      result[key] = value;
      return result;
    }, {});
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toBool(value) {
  if (value === undefined || value === null) return null;
  return String(value) === '1';
}

module.exports = {
  parseKeyValuePayload,
  toNumber,
  toBool,
};