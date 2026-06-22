// drivers/b2500/driver.js
const Homey = require('homey');

class B2500Driver extends Homey.Driver {
  async onInit() {
    this.pvPowerChangedTrigger = this.homey.flow.getDeviceTriggerCard('pv_power_changed');
    this.pvPowerAboveThresholdTrigger = this.homey.flow.getDeviceTriggerCard('pv_power_above_threshold');
    this.pvPowerBelowThresholdTrigger = this.homey.flow.getDeviceTriggerCard('pv_power_below_threshold');

    this.homey.flow.getActionCard('set_output_power').registerRunListener(async args => args.device.setOutputPower(args.power));

    this.homey.flow.getConditionCard('battery_above').registerRunListener(async args => args.device.isCapabilityAbove('measure_battery', args.value));
    this.homey.flow.getConditionCard('battery_below').registerRunListener(async args => args.device.isCapabilityBelow('measure_battery', args.value));

    this.homey.flow.getConditionCard('pv_power_above').registerRunListener(async args => args.device.isCapabilityAbove('marstek_pv_power', args.value));
    this.homey.flow.getConditionCard('pv_power_below').registerRunListener(async args => args.device.isCapabilityBelow('marstek_pv_power', args.value));

    this.homey.flow.getConditionCard('output_power_above').registerRunListener(async args => args.device.isCapabilityAbove('marstek_output_power', args.value));
    this.homey.flow.getConditionCard('output_power_below').registerRunListener(async args => args.device.isCapabilityBelow('marstek_output_power', args.value));

    this.homey.flow.getConditionCard('output_enabled').registerRunListener(async args => args.device.isOutputEnabled(args.output));

    this.log('B2500 driver initialized');
  }

  async onPair(session) {
    session.setHandler('probe_device', async data => {
      return this.homey.app.probeDevice(data);
    });
  }

  async triggerPvPowerChanged(device, pvPower) {
    if (!this.pvPowerChangedTrigger) return;
    await this.pvPowerChangedTrigger.trigger(device, { pv_power: pvPower }).catch(this.error);
  }

  async triggerPvPowerThresholds(device, previousPvPower, currentPvPower) {
    const tokens = { pv_power: currentPvPower };
    const state = { previousPvPower, currentPvPower };

    if (this.pvPowerAboveThresholdTrigger) {
      await this.pvPowerAboveThresholdTrigger.trigger(device, tokens, state).catch(this.error);
    }

    if (this.pvPowerBelowThresholdTrigger) {
      await this.pvPowerBelowThresholdTrigger.trigger(device, tokens, state).catch(this.error);
    }
  }
}

module.exports = B2500Driver;
