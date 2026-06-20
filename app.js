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

  async discoverDevices(timeoutMs = 8000) {
    if (!this.client?.connected) {
      throw new Error('MQTT client is not connected');
    }

    const discovered = new Map();
    const discoveryTopic = 'hame_energy/+/device/+/ctrl';

    const onMessage = (topic, payload) => {
      const match = topic.match(/^hame_energy\/([^/]+)\/device\/([^/]+)\/ctrl$/);
      if (!match) return;

      const [, model, deviceId] = match;

      discovered.set(deviceId, {
        name: `Marstek ${model} ${deviceId}`,
        data: {
          id: `${model}-${deviceId}`,
        },
        settings: {
          protocol_version: 'v2',
          mqtt_state_topic: topic,
          mqtt_command_topic: `hame_energy/${model}/App/${deviceId}/ctrl`,
        },
      });
    };

    this.client.on('message', onMessage);

    await new Promise((resolve, reject) => {
      this.client.subscribe(discoveryTopic, error => {
        if (error) reject(error);
        else resolve();
      });
    });

    try {
      await new Promise(resolve => setTimeout(resolve, timeoutMs));
    } finally {
      this.client.off('message', onMessage);
      this.client.unsubscribe(discoveryTopic);
    }

    return Array.from(discovered.values());
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
