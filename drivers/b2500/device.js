// drivers/b2500/device.js
const Homey = require('homey');
const protocols = require('../../lib/marstek/b2500/protocols');
const {
  buildHomeyPowerLevelScheduleBody,
  buildScheduleBodyFromSlots,
  getHomeyPowerLevelFromSlots,
  updateUserScheduleSlots,
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

function whToKwh(value) {
  const wh = Number(value);
  if (!Number.isFinite(wh)) return null;
  return wh / 1000;
}

class B2500Device extends Homey.Device {
  async onInit() {
    this.settings = this.getSettings();
    this.protocol = protocols.create(this.settings.protocol_version || 'v2');
    this.role = this.getStoreValue('role') || 'battery';
    this.lastScheduleSlots = [];

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

    if (this.role !== 'pv' && this.hasCapability('target_power')) {
      this.registerCapabilityListener('target_power', async value => this.setTargetPower(value));
    }

    if (this.role !== 'pv' && this.hasCapability('target_power_mode')) {
      this.registerCapabilityListener('target_power_mode', async value => this.setTargetPowerMode(value));
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

    if (Array.isArray(values.marstek_schedule_slots)) {
      this.lastScheduleSlots = values.marstek_schedule_slots;
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
    await this.syncTargetPowerFromSchedule(values.marstek_schedule_slots);

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

  getScheduleSlots() {
    if (this.role === 'pv') {
      throw new Error('Schedules are only available on the battery device');
    }

    return Array.isArray(this.lastScheduleSlots) ? this.lastScheduleSlots : [];
  }

  async refreshScheduleSlots() {
    await this.refreshState();
    await delay(1500);
    return this.getScheduleSlots();
  }

  async saveUserScheduleSlots(userSlots) {
    if (this.role === 'pv') {
      throw new Error('Schedules can only be edited on the battery device');
    }

    const nextSlots = updateUserScheduleSlots(this.getScheduleSlots(), userSlots);
    const commandBody = buildScheduleBodyFromSlots(nextSlots);
    const command = this.protocol.setTimerSchedule(commandBody);

    await this.sendCommand(command);
    this.lastScheduleSlots = nextSlots;
    await delay(1000);
    await this.refreshState();
    await delay(1500);

    return this.getScheduleSlots();
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

  async syncTargetPowerFromSchedule(scheduleSlots) {
    if (!this.hasCapability('target_power')) return;

    const scheduledPowerLevel = getHomeyPowerLevelFromSlots(scheduleSlots);

    if (scheduledPowerLevel === null) {
      if (this.hasCapability('target_power_mode') && this.getCapabilityValue('target_power_mode') !== 'device') {
        await this.setCapabilityValue('target_power_mode', 'device').catch(this.error);
      }
      return;
    }

    const targetPower = scheduledPowerLevel === 0 ? 0 : -Math.abs(Math.round(scheduledPowerLevel));

    if (this.hasCapability('target_power_mode') && this.getCapabilityValue('target_power_mode') !== 'homey') {
      await this.setCapabilityValue('target_power_mode', 'homey').catch(this.error);
    }

    if (this.getCapabilityValue('target_power') !== targetPower) {
      await this.setCapabilityValue('target_power', targetPower).catch(this.error);
    }
  }

  async setTargetPower(value) {
    if (this.role === 'pv') {
      throw new Error('Target power cannot be set on the PV companion device');
    }

    const targetPower = Number(value);
    if (!Number.isFinite(targetPower)) {
      throw new Error('Invalid target power');
    }

    if (targetPower > 0) {
      throw new Error('Charging via positive target_power is not supported yet');
    }

    if (this.hasCapability('target_power_mode')) {
      await this.setCapabilityValue('target_power_mode', 'homey').catch(this.error);
    }

    await this.setOutputPowerSchedule(Math.abs(Math.round(targetPower)));
    await this.setCapabilityValue('target_power', targetPower).catch(this.error);
  }

  async setTargetPowerMode(value) {
    if (this.role === 'pv') {
      throw new Error('Target power mode cannot be set on the PV companion device');
    }

    if (value !== 'homey' && this.hasCapability('target_power')) {
      await this.setCapabilityValue('target_power', 0).catch(this.error);
    }
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
    await delay(1000);
    await this.refreshState();
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
