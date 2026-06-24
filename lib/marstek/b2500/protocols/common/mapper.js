// lib/marstek/b2500/protocols/common/mapper.js
const { toNumber, toBool } = require('./parser');
const { parseScheduleSlots } = require('../../services/ScheduleService');

function sum(...values) {
  const nums = values.map(toNumber).filter(v => v !== null);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0);
}

function whToKwh(value) {
  const wh = toNumber(value);
  if (wh === null) return null;
  return wh / 1000;
}

function invertPower(value) {
  const power = toNumber(value);
  if (power === null) return null;
  return -power;
}

function mapState(d) {
  const pv1Power = toNumber(d.w1);
  const pv2Power = toNumber(d.w2);
  const pvPower = sum(d.w1, d.w2);
  const output1Power = toNumber(d.g1);
  const output2Power = toNumber(d.g2);
  const outputPower = sum(d.g1, d.g2);
  const scheduleSlots = parseScheduleSlots(d);

  return {
    measure_battery: toNumber(d.pe),

    // Homey home batteries use negative power while the battery is discharging.
    measure_power: invertPower(outputPower),

    // Keep charged energy at 0 for now. PV charging is represented by the PV device
    // and must not be counted again as grid/import charging on the battery.
    'meter_power.charged': 0,
    'meter_power.discharged': whToKwh(d.bs),

    b2500_available_energy: toNumber(d.kn),

    marstek_pv1_power: pv1Power,
    marstek_pv2_power: pv2Power,
    marstek_pv_power: pvPower,

    'measure_power.pv1': pv1Power,
    'measure_power.pv2': pv2Power,

    marstek_output1_power: output1Power,
    marstek_output2_power: output2Power,
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

    // Backwards-compatible names kept for parsing and potential future capabilities.
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
