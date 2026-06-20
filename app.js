// app.js
const Homey = require('homey');
const mqtt = require('mqtt');

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

  buildMarstekDevice({ model, deviceId }) {
    const normalizedModel = String(model || '').trim();
    const normalizedDeviceId = String(deviceId || '').trim().toLowerCase();

    if (!normalizedModel) {
      throw new Error('Missing device model');
    }

    if (!/^[a-f0-9]{12}$/i.test(normalizedDeviceId)) {
      throw new Error('Device ID must be a 12 character hexadecimal value');
    }

    return {
      name: `Marstek ${normalizedModel} ${normalizedDeviceId}`,
      data: {
        id: `${normalizedModel}-${normalizedDeviceId}`,
      },
      settings: {
        protocol_version: 'v2',
        mqtt_state_topic: `hame_energy/${normalizedModel}/device/${normalizedDeviceId}/ctrl`,
        mqtt_command_topic: `hame_energy/${normalizedModel}/App/${normalizedDeviceId}/ctrl`,
      },
    };
  }

  async probeDevice({ model, deviceId, timeoutMs = 8000 }) {
    if (!this.client?.connected) {
      throw new Error('MQTT client is not connected');
    }

    const device = this.buildMarstekDevice({ model, deviceId });
    const stateTopic = device.settings.mqtt_state_topic;
    const commandTopic = device.settings.mqtt_command_topic;

    let resolved = false;

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.client.off('message', onMessage);
        this.client.unsubscribe(stateTopic);
      };

      const onMessage = (topic, payload) => {
        if (topic !== stateTopic) return;

        const text = payload.toString();
        if (!text.includes('pe=') && !text.includes('vv=')) return;

        resolved = true;
        cleanup();
        resolve(device);
      };

      const timer = setTimeout(() => {
        if (resolved) return;
        cleanup();
        reject(new Error('No response from device. Check model, device ID and MQTT connection.'));
      }, timeoutMs);

      this.client.on('message', onMessage);
      this.client.subscribe(stateTopic, error => {
        if (error) {
          cleanup();
          reject(error);
          return;
        }

        this.client.publish(commandTopic, 'cd=01');
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
