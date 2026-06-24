// drivers/b2500-pv/device.js
const Homey = require('homey');
const protocols = require('../../lib/marstek/b2500/protocols');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function whToKwh(value) {
  const wh = Number(value);
  if (!Number.isFinite(wh)) return null;
  return wh / 1000;
}

class B2500PvDevice extends Homey.Device {
  async onInit() {
    this.settings = this.getSettings();
    this.protocol = protocols.create(this.settings.protocol_version || 'v2');
    this.role = 'pv';

    this.stateTopic = this.settings.mqtt_state_topic;

    this.homey.app.registerDevice(this);

    if (this.stateTopic) {
      this.homey.app.subscribeDevice(this, this.stateTopic);
    }

    this.refreshStateSoon(1000).catch(this.error);
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.settings = newSettings;

    if (changedKeys.includes('protocol_version')) {
      this.protocol = protocols.create(newSettings.protocol_version || 'v2');
    }

    if (changedKeys.includes('mqtt_state_topic')) {
      if (oldSettings.mqtt_state_topic) {
        this.homey.app.unsubscribeDevice(this, oldSettings.mqtt_state_topic);
      }

      this.stateTopic = newSettings.mqtt_state_topic;

      if (this.stateTopic) {
        this.homey.app.subscribeDevice(this, this.stateTopic);
      }

      this.refreshStateSoon(1000).catch(this.error);
    }
  }

  async onMqttMessage(topic, payload) {
    if (topic !== this.stateTopic) return;

    let values;

    try {
      values = this.protocol.parseState(payload);
    } catch (err) {
      this.error('Failed to parse Marstek PV payload', err);
      return;
    }

    await this.updatePvDeviceState(values);
  }

  async updatePvDeviceState(values) {
    const previousPvPower = Number(this.getCapabilityValue('measure_power'));
    const currentPvPower = Number(values.marstek_pv_power);
    const pvEnergyKwh = whToKwh(values.marstek_pv_energy_wh);

    await this.setNumberCapability('measure_power', values.marstek_pv_power);
    await this.setNumberCapability('measure_power.pv1', values['measure_power.pv1']);
    await this.setNumberCapability('measure_power.pv2', values['measure_power.pv2']);
    await this.setNumberCapability('meter_power', pvEnergyKwh);

    if (
      Number.isFinite(currentPvPower)
      && Number.isFinite(previousPvPower)
      && currentPvPower !== previousPvPower
    ) {
      await this.driver.triggerPvPowerChanged(this, currentPvPower);
      await this.driver.triggerPvPowerThresholds(this, previousPvPower, currentPvPower);
    }
  }

  async setNumberCapability(capability, value) {
    if (!this.hasCapability(capability)) return;

    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return;

    await this.setCapabilityValue(capability, numberValue).catch(this.error);
  }

  isCapabilityAbove(capability, threshold) {
    if (!this.hasCapability(capability)) return false;

    const value = Number(this.getCapabilityValue(capability));
    const compareTo = Number(threshold);

    if (!Number.isFinite(value) || !Number.isFinite(compareTo)) return false;

    return value > compareTo;
  }

  isCapabilityBelow(capability, threshold) {
    if (!this.hasCapability(capability)) return false;

    const value = Number(this.getCapabilityValue(capability));
    const compareTo = Number(threshold);

    if (!Number.isFinite(value) || !Number.isFinite(compareTo)) return false;

    return value < compareTo;
  }

  async refreshStateSoon(delayMs = 0) {
    if (delayMs > 0) {
      await delay(delayMs);
    }

    return this.refreshState();
  }

  refreshState() {
    if (!this.settings.mqtt_command_topic) return Promise.resolve();
    return this.homey.app.publish(this.settings.mqtt_command_topic, 'cd=01');
  }

  async onDeleted() {
    if (this.stateTopic) {
      this.homey.app.unsubscribeDevice(this, this.stateTopic);
    }

    this.homey.app.unregisterDevice(this);
  }
}

module.exports = B2500PvDevice;
