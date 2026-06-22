// lib/marstek/b2500/services/ScheduleService.js
const HOMEY_POWER_SLOT = 5;
const DEFAULT_SLOT_POWER = 80;
const HOMEY_POWER_START = '6:0';
const HOMEY_POWER_END = '22:0';
const SCHEDULE_SLOT_COUNT = 5;

function assertOutputPower(watts) {
  const value = Number(watts);

  if (!Number.isFinite(value)) {
    throw new Error('Invalid output power');
  }

  if (value < 0 || value > 2500) {
    throw new Error('Output power must be between 0 and 2500 W');
  }

  return Math.round(value);
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toEnabled(value) {
  if (value === undefined || value === null) return null;
  return String(value) === '1';
}

function normalizeTime(value) {
  if (value === undefined || value === null) return null;
  return String(value).trim();
}

function createDisabledSlot(slot) {
  return {
    slot,
    enabled: false,
    start: '0:0',
    end: '0:0',
    power: DEFAULT_SLOT_POWER,
  };
}

function createHomeyPowerSlot(power) {
  return {
    slot: HOMEY_POWER_SLOT,
    enabled: power > 0,
    start: HOMEY_POWER_START,
    end: HOMEY_POWER_END,
    power,
  };
}

function buildScheduleCommand(slots) {
  const parts = ['md=0'];

  for (const slot of slots) {
    parts.push(`a${slot.slot}=${slot.enabled ? 1 : 0}`);
    parts.push(`b${slot.slot}=${slot.start}`);
    parts.push(`e${slot.slot}=${slot.end}`);
    parts.push(`v${slot.slot}=${slot.power}`);
  }

  return parts.join(',');
}

function buildHomeyPowerLevelScheduleBody(watts) {
  const power = assertOutputPower(watts);
  const slots = [
    createDisabledSlot(1),
    createDisabledSlot(2),
    createDisabledSlot(3),
    createDisabledSlot(4),
    createHomeyPowerSlot(power),
  ];

  return buildScheduleCommand(slots);
}

function parseScheduleSlot(data, slot) {
  const enabled = toEnabled(data[`a${slot}`]);
  const start = normalizeTime(data[`b${slot}`]);
  const end = normalizeTime(data[`e${slot}`]);
  const power = toNumber(data[`v${slot}`]);

  if (enabled === null && start === null && end === null && power === null) {
    return null;
  }

  return {
    slot,
    enabled: enabled === true,
    start: start || '0:0',
    end: end || '0:0',
    power: power === null ? DEFAULT_SLOT_POWER : power,
  };
}

function parseScheduleSlots(data) {
  const slots = [];

  for (let slot = 1; slot <= SCHEDULE_SLOT_COUNT; slot += 1) {
    const parsed = parseScheduleSlot(data, slot);
    if (parsed) slots.push(parsed);
  }

  return slots;
}

function getScheduleSlot(slots, slotNumber) {
  if (!Array.isArray(slots)) return null;
  return slots.find(slot => slot.slot === slotNumber) || null;
}

function getHomeyPowerSlot(slots) {
  return getScheduleSlot(slots, HOMEY_POWER_SLOT);
}

function isHomeyPowerSlot(slot) {
  if (!slot) return false;
  return slot.slot === HOMEY_POWER_SLOT
    && slot.start === HOMEY_POWER_START
    && slot.end === HOMEY_POWER_END;
}

function getHomeyPowerLevelFromSlots(slots) {
  const slot = getHomeyPowerSlot(slots);

  if (!isHomeyPowerSlot(slot)) return null;
  if (!slot.enabled) return 0;

  return slot.power;
}

module.exports = {
  HOMEY_POWER_SLOT,
  HOMEY_POWER_START,
  HOMEY_POWER_END,
  SCHEDULE_SLOT_COUNT,
  buildHomeyPowerLevelScheduleBody,
  getHomeyPowerLevelFromSlots,
  getHomeyPowerSlot,
  isHomeyPowerSlot,
  parseScheduleSlots,
};
