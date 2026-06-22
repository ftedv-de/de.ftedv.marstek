// lib/marstek/b2500/services/ScheduleService.js
const HOMEY_POWER_SLOT = 5;
const DEFAULT_SLOT_POWER = 80;
const HOMEY_POWER_START = '6:0';
const HOMEY_POWER_END = '22:0';

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

module.exports = {
  HOMEY_POWER_SLOT,
  HOMEY_POWER_START,
  HOMEY_POWER_END,
  buildHomeyPowerLevelScheduleBody,
};
