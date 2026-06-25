// lib/marstek/b2500/services/ScheduleService.js
const HOMEY_POWER_SLOT = 5;
const USER_SCHEDULE_SLOTS = [1, 2, 3, 4];
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

function normalizeTargetPowerForSchedule(watts) {
  const value = Math.abs(Number(watts));

  if (!Number.isFinite(value)) {
    throw new Error('Invalid target power');
  }

  if (value > 2500) {
    throw new Error('Target power exceeds the supported discharge range');
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

function parseTime(value) {
  const text = normalizeTime(value);
  if (!text) return null;

  const match = text.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;

  return { hour, minute, value: `${hour}:${minute}` };
}

function assertValidTime(value, label) {
  const parsed = parseTime(value);
  if (!parsed) {
    throw new Error(`${label} must use H:M format and be a valid time`);
  }

  return parsed.value;
}

function assertUserSlot(slot) {
  const numberValue = Number(slot);

  if (!USER_SCHEDULE_SLOTS.includes(numberValue)) {
    throw new Error('Only user schedule slots 1-4 can be edited');
  }

  return numberValue;
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

function normalizeSlot(slot) {
  const slotNumber = Number(slot.slot);

  return {
    slot: slotNumber,
    enabled: slot.enabled === true,
    start: assertValidTime(slot.start || '0:0', `Slot ${slotNumber} start`),
    end: assertValidTime(slot.end || '0:0', `Slot ${slotNumber} end`),
    power: assertOutputPower(slot.power === undefined || slot.power === null ? DEFAULT_SLOT_POWER : slot.power),
  };
}

function normalizeSlots(slots) {
  const result = [];

  for (let slot = 1; slot <= SCHEDULE_SLOT_COUNT; slot += 1) {
    const existing = getScheduleSlot(slots, slot);
    result.push(existing ? normalizeSlot(existing) : createDisabledSlot(slot));
  }

  return result;
}

function buildScheduleCommand(slots) {
  const parts = ['md=0'];
  const normalizedSlots = normalizeSlots(slots);

  for (const slot of normalizedSlots) {
    parts.push(`d${slot.slot}=${slot.enabled ? 1 : 0}`);
    parts.push(`e${slot.slot}=${slot.start}`);
    parts.push(`f${slot.slot}=${slot.end}`);
    parts.push(`h${slot.slot}=${slot.power}`);
  }

  return parts.join(',');
}

function updateHomeyPowerSlot(currentSlots, targetPower) {
  const power = normalizeTargetPowerForSchedule(targetPower);
  const slots = normalizeSlots(currentSlots);

  // Marstek schedule values are always positive. Homey target_power uses
  // negative values for discharging, so the sign is only translated at the
  // Homey boundary and never stored in the schedule.
  slots[HOMEY_POWER_SLOT - 1] = createHomeyPowerSlot(power);

  return slots;
}

function buildHomeyTargetPowerScheduleBody(currentSlots, targetPower) {
  return buildScheduleCommand(updateHomeyPowerSlot(currentSlots, targetPower));
}

function parseScheduleSlot(data, slot) {
  const enabled = toEnabled(data[`d${slot}`]);
  const start = normalizeTime(data[`e${slot}`]);
  const end = normalizeTime(data[`f${slot}`]);
  const power = toNumber(data[`h${slot}`]);

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
  return slots.find(slot => Number(slot.slot) === Number(slotNumber)) || null;
}

function getHomeyPowerSlot(slots) {
  return getScheduleSlot(slots, HOMEY_POWER_SLOT);
}

function isHomeyPowerSlot(slot) {
  if (!slot) return false;
  return Number(slot.slot) === HOMEY_POWER_SLOT
    && slot.start === HOMEY_POWER_START
    && slot.end === HOMEY_POWER_END;
}

function getHomeyTargetPowerFromSlots(slots) {
  const slot = getHomeyPowerSlot(slots);

  if (!isHomeyPowerSlot(slot)) return null;
  if (!slot.enabled) return 0;

  // Homey target_power must be negative while the battery is discharging.
  // The Marstek schedule stores the same discharge level as a positive value.
  return -Math.abs(assertOutputPower(slot.power));
}

function updateUserScheduleSlots(currentSlots, userSlots) {
  if (!Array.isArray(userSlots)) {
    throw new Error('User schedule slots must be an array');
  }

  const slots = normalizeSlots(currentSlots);

  for (const userSlot of userSlots) {
    const slotNumber = assertUserSlot(userSlot.slot);
    const index = slotNumber - 1;

    const enabled = userSlot.enabled === true;
    const start = assertValidTime(userSlot.start || '0:0', `Slot ${slotNumber} start`);
    const end = assertValidTime(userSlot.end || '0:0', `Slot ${slotNumber} end`);
    const power = assertOutputPower(userSlot.power === undefined || userSlot.power === null ? DEFAULT_SLOT_POWER : userSlot.power);

    if (enabled && start === end) {
      throw new Error(`Slot ${slotNumber}: start and end must differ`);
    }

    slots[index] = {
      slot: slotNumber,
      enabled,
      start,
      end,
      power,
    };
  }

  return slots;
}

function buildScheduleBodyFromSlots(slots) {
  return buildScheduleCommand(slots);
}

module.exports = {
  HOMEY_POWER_SLOT,
  HOMEY_POWER_START,
  HOMEY_POWER_END,
  SCHEDULE_SLOT_COUNT,
  USER_SCHEDULE_SLOTS,
  buildHomeyTargetPowerScheduleBody,
  buildScheduleBodyFromSlots,
  getHomeyPowerSlot,
  getHomeyTargetPowerFromSlots,
  isHomeyPowerSlot,
  parseScheduleSlots,
  updateHomeyPowerSlot,
  updateUserScheduleSlots,
};
