// drivers/b2500/device.js
const Homey = require('homey');
const protocols = require('../../lib/marstek/b2500/protocols');
const {
  buildHomeyTargetPowerScheduleBody,
  buildScheduleBodyFromSlots,
  getHomeyTargetPowerFromSlots,
  updateUserScheduleSlots,
} = require('../../lib/marstek/b2500/services/ScheduleService');

const DEFAULT_POLLING_INTERVAL_SECONDS = 60;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeHomeyTargetPower(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
  if (Object.is(numberValue, -0)) return 0;
  return Math.round(numberValue);
}

function normalizePollingIntervalSeconds(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.max(5, Math.round(seconds));
}

class B2500Device extends Homey.Device {
  async onInit() {
    this.settings = this.getSettings();
    this.protocol = protocols.create(this.settings.protocol_version || 'v2');
    this.lastScheduleSlots = [];
    this.pollingTimer = null;
    this.pollingInProgress = false;
    this.commandQueue = Promise.resolve();

    this.stateTopic = this.settings.mqtt_state_topic;
    this.commandTopic = this.settings.mqtt_command_topic;

    this.homey.app.registerDevice(this);

    if (this.stateTopic) {
      this.homey.app.subscribeDevice(this, this.stateTopic);
    }

    if (this.hasCapability('target_power')) {
      this.registerCapabilityListener('target_power', async value => this.setTargetPower(value));
    }

    if (this.hasCapability('target_power_mode')) {
      this.registerCapabilityListener('target_power_mode', async value => this.setTargetPowerMode(value));
    }

    this.startPolling();
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

    if (changedKeys.includes('polling_interval_seconds')) {
      this.restartPolling();
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

    await this.updateBatteryDeviceState(values);
  }

  async updateBatteryDeviceState(values) {
    for (const [capability, value] of Object.entries(values)) {
      if (value === null || value === undefined) continue;
      if (!this.hasCapability(capability)) continue;

      await this.setCapabilityValue(capability, value).catch(this.error);
    }

    await this.syncTargetPowerFromSchedule(values.marstek_schedule_slots);
  }

  getScheduleSlots() {
    return Array.isArray(this.lastScheduleSlots) ? this.lastScheduleSlots : [];
  }

  async refreshScheduleSlots() {
    await this.refreshState();
    await delay(1500);
    return this.getScheduleSlots();
  }

  async saveUserScheduleSlots(userSlots) {
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

  async syncTargetPowerFromSchedule(scheduleSlots) {
    if (!this.hasCapability('target_power')) return;

    const scheduledTargetPower = getHomeyTargetPowerFromSlots(scheduleSlots);

    if (scheduledTargetPower === null || scheduledTargetPower === 0) {
      await this.updateTargetPowerModeCapability('device');

      if (scheduledTargetPower === 0) {
        await this.updateTargetPowerCapability(0);
      }
      return;
    }

    await this.updateTargetPowerCapability(scheduledTargetPower);
    await this.updateTargetPowerModeCapability('homey');
  }

  async setTargetPower(value) {
    const targetPower = normalizeHomeyTargetPower(value);
    if (targetPower === null) {
      throw new Error('Invalid target power');
    }

    if (targetPower > 0) {
      throw new Error('Charging via positive target_power is not supported by this device');
    }

    await this.writeTargetPowerSchedule(targetPower);
    await this.updateTargetPowerCapability(targetPower);
    await this.refreshStateAfterWrite();
  }

  async setTargetPowerMode(value) {
    if (value === 'device') {
      await this.writeTargetPowerSchedule(0);
      await this.updateTargetPowerModeCapability('device');
      await this.refreshStateAfterWrite();
      return;
    }

    if (value === 'homey') {
      await this.updateTargetPowerModeCapability('homey');
      return;
    }

    throw new Error(`Unsupported target power mode: ${value}`);
  }

  async updateTargetPowerCapability(targetPower) {
    if (!this.hasCapability('target_power')) return;

    const currentValue = normalizeHomeyTargetPower(this.getCapabilityValue('target_power'));
    const nextValue = normalizeHomeyTargetPower(targetPower);

    if (nextValue === null || currentValue === nextValue) return;

    await this.setCapabilityValue('target_power', nextValue).catch(this.error);
  }

  async updateTargetPowerModeCapability(mode) {
    if (!this.hasCapability('target_power_mode')) return;
    if (this.getCapabilityValue('target_power_mode') === mode) return;

    await this.setCapabilityValue('target_power_mode', mode).catch(this.error);
  }

  async writeTargetPowerSchedule(targetPower) {
    const commandBody = buildHomeyTargetPowerScheduleBody(this.getScheduleSlots(), targetPower);
    const command = this.protocol.setTimerSchedule(commandBody);

    return this.sendCommand(command);
  }

  async refreshStateAfterWrite() {
    await delay(1000);
    await this.refreshState();
  }

  async updateStatus() {
    return this.refreshState();
  }

  getPollingIntervalMs() {
    const settings = this.getSettings();
    const seconds = normalizePollingIntervalSeconds(
      settings.polling_interval_seconds ?? DEFAULT_POLLING_INTERVAL_SECONDS,
    );

    return seconds > 0 ? seconds * 1000 : 0;
  }

  startPolling() {
    this.stopPolling();

    const intervalMs = this.getPollingIntervalMs();
    if (intervalMs <= 0) return;

    this.pollingTimer = this.homey.setInterval(() => {
      this.pollStatus().catch(this.error);
    }, intervalMs);
  }

  stopPolling() {
    if (!this.pollingTimer) return;

    this.homey.clearInterval(this.pollingTimer);
    this.pollingTimer = null;
  }

  restartPolling() {
    this.startPolling();
  }

  async pollStatus() {
    if (this.pollingInProgress) return;

    this.pollingInProgress = true;

    try {
      await this.updateStatus();
    } finally {
      this.pollingInProgress = false;
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

  getOutputPower() {
    const output1Power = Number(this.getCapabilityValue('marstek_output1_power'));
    const output2Power = Number(this.getCapabilityValue('marstek_output2_power'));

    return (Number.isFinite(output1Power) ? output1Power : 0)
      + (Number.isFinite(output2Power) ? output2Power : 0);
  }

  isOutputPowerAbove(threshold) {
    const value = this.getOutputPower();
    const compareTo = Number(threshold);

    if (!Number.isFinite(value) || !Number.isFinite(compareTo)) return false;

    return value > compareTo;
  }

  isOutputPowerBelow(threshold) {
    const value = this.getOutputPower();
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

    const run = () => this.homey.app.publish(this.commandTopic, command);
    const queued = this.commandQueue.then(run, run);

    this.commandQueue = queued.catch(err => {
      this.error('Queued MQTT command failed', err);
    });

    return queued;
  }

  async onDeleted() {
    this.stopPolling();

    if (this.stateTopic) {
      this.homey.app.unsubscribeDevice(this, this.stateTopic);
    }

    this.homey.app.unregisterDevice(this);
  }
}

module.exports = B2500Device;
