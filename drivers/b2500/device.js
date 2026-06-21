// drivers/b2500/device.js
const Homey = require('homey');
const protocols = require('../../lib/protocols');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class B2500Device extends Homey.Device {
  async onInit() {
    this.settings = this.getSettings();
    this.protocol = protocols.create(this.settings.protocol_version || 'v2');

    this.stateTopic = this.settings.mqtt_state_topic;
    this.commandTopic = this.settings.mqtt_command_topic;

    this.homey.app.registerDevice(this);

    if (this.stateTopic) {
      this.homey.app.subscribeDevice(this, this.stateTopic);
    }

    if (this.hasCapability('marstek_power_level_preset')) {
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

    for (const [capability, value] of Object.entries(values)) {
      if (value === null || value === undefined) continue;
      if (!this.hasCapability(capability)) continue;

      await this.setCapabilityValue(capability, value).catch(this.error);
    }
  }

  async setOutputPower(watts) {
    return this.setOutputPowerSchedule(watts);
  }

  async setOutputPowerSchedule(watts) {
    const value = Number(watts);

    if (!Number.isFinite(value)) {
      throw new Error('Invalid output power');
    }

    if (value < 0 || value > 2500) {
      throw new Error('Output power must be between 0 and 2500 W');
    }

    const power = Math.round(value);
    const command = [
      'cd=20',
      'md=0',
      `a1=${power > 0 ? 1 : 0}`,
      'b1=0:0',
      'e1=22:0',
      `v1=${power}`,
      'a2=0',
      'b2=0:0',
      'e2=0:0',
      'v2=80',
      'a3=0',
      'b3=0:0',
      'e3=0:0',
      'v3=80',
      'a4=0',
      'b4=0:0',
      'e4=0:0',
      'v4=80',
      'a5=0',
      'b5=0:0',
      'e5=0:0',
      'v5=80',
    ].join(',');

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
