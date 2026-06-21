// lib/marstek/b2500/models.js
const MODELS_BY_HARDWARE_VERSION = Object.freeze({
  v1: ['HMB-1'],
  v2: ['HMJ-2', 'HMA-1', 'HMF-1', 'HMK-1'],
});

function normalizeHardwareVersion(version) {
  return String(version || 'v2').trim().toLowerCase();
}

function getModelsForHardwareVersion(version) {
  const normalizedVersion = normalizeHardwareVersion(version);
  return MODELS_BY_HARDWARE_VERSION[normalizedVersion] || null;
}

function isSupportedHardwareVersion(version) {
  return Array.isArray(getModelsForHardwareVersion(version));
}

module.exports = {
  MODELS_BY_HARDWARE_VERSION,
  getModelsForHardwareVersion,
  isSupportedHardwareVersion,
  normalizeHardwareVersion,
};
