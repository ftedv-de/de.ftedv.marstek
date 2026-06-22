// drivers/b2500-pv/device.js
const Homey = require('homey');
const protocols = require('../../lib/marstek/b2500/protocols');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class B2500PvDevice extends Homey.Device {
  async onInit() {
    this.settings = this.getSettings();
    this.protocol = protocols.create(this.settings.protocol_version || 'v2');

    this.stateTopic = this.settings.mqtt_state_topic;
    this.commandTopic = this.settings.mqtt_command_topic;

    this.homey.app.registerDevice(this);

    if (this.stateTopic) {
      this.homey.app.subscribeDevice(this, this.stateTopic);
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
      this.error('Failed to parse Marstek PV payload', err);
      return;
    }

    await this.setNumberCapability('measure_power', values.marstek_pv_power);
    await this.setNumberCapability('marstek_pv_power', values.marstek_pv_power);
    await this.setNumberCapability('marstek_pv1_power', values.marstek_pv1_power);
    await this.setNumberCapability('marstek_pv2_power', values.marstek_pv2_power);
  }

  async setNumberCapability(capability, value) {
    if (!this.hasCapability(capability)) return;

    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return;

    await this.setCapabilityValue(capability, numberValue).catch(this.error);
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

module.exports = B2500PvDevice;
