// app.js
const Homey = require('homey');
const mqtt = require('mqtt');
const { buildB2500DeviceSet, normalizeDeviceId } = require('./lib/marstek/b2500/factory');
const { getModelsForHardwareVersion, normalizeHardwareVersion } = require('./lib/marstek/b2500/models');

class MarstekApp extends Homey.App {
  async onInit() {
    this.topicDevices = new Map();
    this.devices = new Set();

    this.connectMqtt();
  }

  connectMqtt() {
    const host = this.homey.settings.get('mqtt_host');
    const port = this.homey.settings.get('mqtt_port') || 1883;
    const username = this.homey.settings.get('mqtt_username');
    const password = this.homey.settings.get('mqtt_password');
    const useTls = this.homey.settings.get('mqtt_tls') === true;

    if (!host) {
      this.log('MQTT host not configured');
      return;
    }

    const protocol = useTls ? 'mqtts' : 'mqtt';
    const url = `${protocol}://${host}:${port}`;

    this.client = mqtt.connect(url, {
      username: username || undefined,
      password: password || undefined,
      reconnectPeriod: 10000,
      connectTimeout: 15000,
    });

    this.client.on('connect', () => {
      this.log('MQTT connected');

      for (const topic of this.topicDevices.keys()) {
        this.client.subscribe(topic);
      }
    });

    this.client.on('message', (topic, payload) => {
      const devices = this.topicDevices.get(topic);
      if (!devices) return;

      for (const device of devices) {
        device.onMqttMessage(topic, payload.toString());
      }
    });

    this.client.on('error', err => {
      this.error('MQTT error', err);
    });
  }

  buildMarstekDeviceSet({ model, deviceId, protocolVersion = 'v2' }) {
    return buildB2500DeviceSet({
      model,
      deviceId,
      protocolVersion,
    });
  }

  async probeDevice({ hardwareVersion, protocolVersion, deviceId, timeoutMs = 8000 }) {
    if (!this.client?.connected) {
      throw new Error('MQTT client is not connected');
    }

    const selectedVersion = normalizeHardwareVersion(hardwareVersion || protocolVersion || 'v2');
    const normalizedDeviceId = normalizeDeviceId(deviceId);
    const models = getModelsForHardwareVersion(selectedVersion);

    if (!models) {
      throw new Error('Unsupported hardware version');
    }

    if (!/^[a-f0-9]{12}$/i.test(normalizedDeviceId)) {
      throw new Error('Device ID must be a 12 character hexadecimal value');
    }

    const candidates = models.map(model => this.buildMarstekDeviceSet({
      model,
      deviceId: normalizedDeviceId,
      protocolVersion: selectedVersion,
    }));

    const stateTopicToDeviceSet = new Map(candidates.map(deviceSet => [
      deviceSet.battery.settings.mqtt_state_topic,
      deviceSet,
    ]));

    let resolved = false;

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.client.off('message', onMessage);
        for (const topic of stateTopicToDeviceSet.keys()) {
          this.client.unsubscribe(topic);
        }
      };

      const onMessage = (topic, payload) => {
        const deviceSet = stateTopicToDeviceSet.get(topic);
        if (!deviceSet) return;

        const text = payload.toString();
        if (!text.includes('pe=') && !text.includes('vv=')) return;

        resolved = true;
        cleanup();
        resolve(deviceSet);
      };

      const timer = setTimeout(() => {
        if (resolved) return;
        cleanup();
        reject(new Error('No response from device. Check hardware version, device ID and MQTT connection.'));
      }, timeoutMs);

      this.client.on('message', onMessage);

      const subscriptions = Array.from(stateTopicToDeviceSet.keys()).map(topic => new Promise((resolveSubscribe, rejectSubscribe) => {
        this.client.subscribe(topic, error => {
          if (error) rejectSubscribe(error);
          else resolveSubscribe();
        });
      }));

      Promise.all(subscriptions)
        .then(() => {
          for (const deviceSet of candidates) {
            this.client.publish(deviceSet.battery.settings.mqtt_command_topic, 'cd=01');
          }
        })
        .catch(error => {
          cleanup();
          reject(error);
        });
    });
  }

  registerDevice(device) {
    this.devices.add(device);
  }

  unregisterDevice(device) {
    this.devices.delete(device);
  }

  subscribeDevice(device, topic) {
    if (!this.topicDevices.has(topic)) {
      this.topicDevices.set(topic, new Set());
      this.client?.subscribe(topic);
    }

    this.topicDevices.get(topic).add(device);
  }

  unsubscribeDevice(device, topic) {
    const devices = this.topicDevices.get(topic);
    if (!devices) return;

    devices.delete(device);

    if (devices.size === 0) {
      this.topicDevices.delete(topic);
      this.client?.unsubscribe(topic);
    }
  }

  publish(topic, payload) {
    if (!this.client?.connected) {
      throw new Error('MQTT client is not connected');
    }

    this.client.publish(topic, payload);
  }
}

module.exports = MarstekApp;
