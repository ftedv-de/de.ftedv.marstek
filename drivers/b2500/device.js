// drivers/b2500/device.js
const Homey = require('homey');
const protocols = require('../../lib/marstek/b2500/protocols');
const {
  buildHomeyPowerLevelScheduleBody,
  getHomeyPowerLevelFromSlots,
} = require('../../lib/marstek/b2500/services/ScheduleService');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const OUTPUT_POWER_PRESET_VALUES = new Set([
  '0',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
]);

class B2500Device extends Homey.Device {
  async onInit() {
    this.settings = this.getSettings();
    this.protocol = protocols.create(this.settings.protocol_version || 'v2');
    this.role = this.getStoreValue('role') || 'battery';

    this.stateTopic = this.settings.mqtt_state_topic;
    this.commandTopic = this.settings.mqtt_command_topic;

    this.homey.app.registerDevice(this);

    if (this.stateTopic) {
      this.homey.app.subscribeDevice(this, this.stateTopic);
    }

    if (this.role !== 'pv' && this.hasCapability('marstek_power_level_preset')) {
      this.registerCapabilityListener('marstek_power_level_preset', async value => {
        const watts = Number(value);

        if (!Number.isFinite(watts)) {
          throw new Error('Invalid output power preset');
        }

        await this.setOutputPowerSchedule(watts);
        await this.setCapabilityValue('marstek_power_level_preset', String(watts));
      });
    }

    this.refreshStateSoon(1000).catch(this.error);
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
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

    if (changedKeys.includes('mqtt_command_topic')) {
      this.commandTopic = newSettings.mqtt_command_topic;
      this.refreshStateSoon(1000).catch(this.error);
    }
  }

  async onMqttMessage(topic, payload) {
    if (topic !== this.stateTopic) return;

    let values;

    try {
      values = this.protocol.parseState(payload);
    } catch (err) {
      this.error('Failed to parse Marstek payload', err);
      return;
    }

    if (this.role === 'pv') {
      await this.updatePvDeviceState(values);
      return;
    }

    await this.updateBatteryDeviceState(values);
  }

  async updateBatteryDeviceState(values) {
    const previousPvPower = Number(this.getCapabilityValue('marstek_pv_power'));

    for (const [capability, value] of Object.entries(values)) {
      if (value === null || value === undefined) continue;
      if (!this.hasCapability(capability)) continue;

      await this.setCapabilityValue(capability, value).catch(this.error);
    }

    await this.syncOutputPowerPresetFromSchedule(values.marstek_schedule_slots, values.marstek_threshold_w);

    const currentPvPower = Number(values.marstek_pv_power);

    if (
      Number.isFinite(currentPvPower)
      && Number.isFinite(previousPvPower)
      && currentPvPower !== previousPvPower
    ) {
      await this.driver.triggerPvPowerChanged(this, currentPvPower);
      await this.driver.triggerPvPowerThresholds(this, previousPvPower, currentPvPower);
    }
  }

  async syncOutputPowerPresetFromSchedule(scheduleSlots, fallbackThresholdWatts) {
    const scheduledPowerLevel = getHomeyPowerLevelFromSlots(scheduleSlots);

    if (scheduledPowerLevel !== null) {
      await this.syncOutputPowerPreset(scheduledPowerLevel);
      return;
    }

    await this.syncOutputPowerPreset(fallbackThresholdWatts);
  }

  async syncOutputPowerPreset(watts) {
    if (!this.hasCapability('marstek_power_level_preset')) return;

    const numberValue = Number(watts);
    if (!Number.isFinite(numberValue)) return;

    const preset = String(Math.round(numberValue));
    if (!OUTPUT_POWER_PRESET_VALUES.has(preset)) return;

    if (this.getCapabilityValue('marstek_power_level_preset') === preset) return;

    await this.setCapabilityValue('marstek_power_level_preset', preset).catch(this.error);
  }

  async updatePvDeviceState(values) {
    const previousPvPower = Number(this.getCapabilityValue('marstek_pv_power'));
    const currentPvPower = Number(values.marstek_pv_power);

    await this.setNumberCapability('measure_power', values.marstek_pv_power);
    await this.setNumberCapability('marstek_pv_power', values.marstek_pv_power);
    await this.setNumberCapability('marstek_pv1_power', values.marstek_pv1_power);
    await this.setNumberCapability('marstek_pv2_power', values.marstek_pv2_power);

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

  isOutputEnabled(output) {
    const outputId = String(output || '').trim();
    const capability = outputId === '2'
      ? 'marstek_output2_enabled'
      : 'marstek_output1_enabled';

    if (!this.hasCapability(capability)) return false;

    return this.getCapabilityValue(capability) === true;
  }

  async setOutputPower(watts) {
    if (this.role === 'pv') {
      throw new Error('Output power cannot be set on the PV companion device');
    }

    return this.setOutputPowerSchedule(watts);
  }

  async setOutputPowerSchedule(watts) {
    const commandBody = buildHomeyPowerLevelScheduleBody(watts);
    const command = this.protocol.setTimerSchedule(commandBody);

    await this.sendCommand(command);
    await this.refreshStateSoon(1000);
  }

  async refreshStateSoon(delayMs = 0) {
    if (delayMs > 0) {
      await delay(delayMs);
    }

    return this.refreshState();
  }

  refreshState() {
    return this.sendCommand('cd=01');
  }

  sendCommand(command) {
    if (!this.commandTopic) {
      throw new Error('No MQTT command topic configured');
    }

    return this.homey.app.publish(this.commandTopic, command);
  }

  async onDeleted() {
    if (this.stateTopic) {
      this.homey.app.unsubscribeDevice(this, this.stateTopic);
    }

    this.homey.app.unregisterDevice(this);
  }
}

module.exports = B2500Device;
