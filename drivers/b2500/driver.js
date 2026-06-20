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
    const devices = await this.homey.app.discoverDevices();
    return devices;
  }
}

module.exports = B2500Driver;
