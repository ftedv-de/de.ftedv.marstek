// drivers/b2500/driver.js
const Homey = require('homey');

class B2500Driver extends Homey.Driver {
  async onInit() {
    this.homey.flow
      .getActionCard('set_output_power')
      .registerRunListener(async args => {
        return args.device.setOutputPower(args.power);
      });

    this.log('B2500 driver initialized');
  }

  async onPairListDevices() {
    return [
      {
        name: 'Marstek B2500 HMJ',
        data: {
          id: 'b2500-hmj-18cedfd22770',
        },
        settings: {
          protocol_version: 'v2',
          mqtt_state_topic: 'hame_energy/HMJ-2/device/18cedfd22770/ctrl',
          mqtt_command_topic: 'hame_energy/HMJ-2/App/18cedfd22770/ctrl',
        },
      },
    ];
  }
}

module.exports = B2500Driver;
