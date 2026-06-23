// lib/marstek/b2500/protocols/common/mapper.js
const { toNumber, toBool } = require('./parser');
const { parseScheduleSlots } = require('../../services/ScheduleService');

function sum(...values) {
  const nums = values.map(toNumber).filter(v => v !== null);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0);
}

function mapState(d) {
  const pvPower = sum(d.w1, d.w2);
  const outputPower = sum(d.g1, d.g2);
  const scheduleSlots = parseScheduleSlots(d);

  return {
    measure_battery: toNumber(d.pe),

    // Standard Homey power shows the current AC output power.
    // PV input power is exposed separately as marstek_pv_power.
    measure_power: outputPower,

    marstek_pv1_power: toNumber(d.w1),
    marstek_pv2_power: toNumber(d.w2),
    marstek_pv_power: pvPower,

    marstek_output1_power: toNumber(d.g1),
    marstek_output2_power: toNumber(d.g2),
    marstek_output_power: outputPower,

    marstek_output1_enabled: toBool(d.o1),
    marstek_output2_enabled: toBool(d.o2),

    marstek_battery_percent: toNumber(d.pe),
    marstek_dod: toNumber(d.do),
    marstek_threshold_w: toNumber(d.lv),
    marstek_firmware_version: toNumber(d.vv),

    marstek_charge_mode: toNumber(d.cs),
    marstek_discharge_mode: toNumber(d.cd),

    marstek_pack1_connected: toBool(d.b1),
    marstek_pack2_connected: toBool(d.b2),

    marstek_capacity_wh: toNumber(d.kn),

    marstek_cell_temp_min: toNumber(d.tl),
    marstek_cell_temp_max: toNumber(d.th),

    marstek_wifi_signal: toNumber(d.ws || d.ts),

    marstek_battery_charge_wh: toNumber(d.bc),
    marstek_battery_discharge_wh: toNumber(d.bs),
    marstek_pv_energy_wh: toNumber(d.pt),
    marstek_inverter_output_wh: toNumber(d.it),

    // Backwards-compatible names kept for the current capabilities.
    marstek_daily_battery_charge: toNumber(d.bc),
    marstek_daily_battery_discharge: toNumber(d.bs),
    marstek_daily_pv_charge: toNumber(d.pt),
    marstek_daily_inverter_output: toNumber(d.it),

    marstek_ct_power_1: toNumber(d.m0),
    marstek_ct_power_2: toNumber(d.m1),
    marstek_ct_power_3: toNumber(d.m2),
    marstek_micro_inverter_power: toNumber(d.m3),

    marstek_sensor_connected: toBool(d.sg),
    marstek_limited: toBool(d.lmf),

    marstek_schedule_slots: scheduleSlots,
  };
}

module.exports = {
  mapState,
};
