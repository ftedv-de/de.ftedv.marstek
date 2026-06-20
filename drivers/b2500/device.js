// drivers/b2500/device.js
const Homey = require('homey');
const protocols = require('../../lib/protocols');

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

        await this.sendCommand(this.protocol.setOutputThreshold(watts));
        await this.setCapabilityValue('marstek_power_level_preset', String(watts));
      });
    }
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
    }

    if (changedKeys.includes('mqtt_command_topic')) {
      this.commandTopic = newSettings.mqtt_command_topic;
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
    const value = Number(watts);

    if (!Number.isFinite(value)) {
      throw new Error('Invalid output power');
    }

    if (value < 0 || value > 2500) {
      throw new Error('Output power must be between 0 and 2500 W');
    }

    return this.sendCommand(this.protocol.setOutputThreshold(Math.round(value)));
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
