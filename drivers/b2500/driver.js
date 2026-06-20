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

  async onPair(session) {
    session.setHandler('probe_device', async data => {
      return this.homey.app.probeDevice(data);
    });
  }
}

module.exports = B2500Driver;
