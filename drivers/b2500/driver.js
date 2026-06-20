// drivers/b2500/driver.js
const Homey = require('homey');

class B2500Driver extends Homey.Driver {
  async onInit() {
    this.log('B2500 driver initialized');
  }

  async onPairListDevices() {
    return [
      {
        name: 'Marstek B2500',
        data: {
          id: `b2500-${Date.now()}`,
        },
        settings: {
          protocol_version: 'v2',
          mqtt_state_topic: 'hame_energy/device/ctrl',
          mqtt_command_topic: 'hame_energy/App/ctrl',
        },
      },
    ];
  }
}

module.exports = B2500Driver;
