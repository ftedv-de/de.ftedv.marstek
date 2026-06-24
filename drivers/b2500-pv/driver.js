// drivers/b2500-pv/driver.js
const Homey = require('homey');

class B2500PvDriver extends Homey.Driver {
  async onInit() {
    this.pvPowerChangedTrigger = this.homey.flow.getDeviceTriggerCard('pv_power_changed');
    this.pvPowerAboveThresholdTrigger = this.homey.flow.getDeviceTriggerCard('pv_power_above_threshold');
    this.pvPowerBelowThresholdTrigger = this.homey.flow.getDeviceTriggerCard('pv_power_below_threshold');

    this.pvPowerAboveThresholdTrigger.registerRunListener(async (args, state) => {
      const threshold = Number(args.threshold);
      const previous = Number(state.previousPvPower);
      const current = Number(state.currentPvPower);

      if (!Number.isFinite(threshold) || !Number.isFinite(previous) || !Number.isFinite(current)) return false;
      return previous <= threshold && current > threshold;
    });

    this.pvPowerBelowThresholdTrigger.registerRunListener(async (args, state) => {
      const threshold = Number(args.threshold);
      const previous = Number(state.previousPvPower);
      const current = Number(state.currentPvPower);

      if (!Number.isFinite(threshold) || !Number.isFinite(previous) || !Number.isFinite(current)) return false;
      return previous >= threshold && current < threshold;
    });

    this.homey.flow.getConditionCard('pv_power_above').registerRunListener(async args => args.device.isCapabilityAbove('measure_power', args.value));
    this.homey.flow.getConditionCard('pv_power_below').registerRunListener(async args => args.device.isCapabilityBelow('measure_power', args.value));

    this.log('B2500 PV driver initialized');
  }

  async onPair(session) {
    session.setHandler('probe_device', async data => {
      return this.homey.app.probeDevice({
        ...data,
        createPvDevice: true,
      });
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

module.exports = B2500PvDriver;
