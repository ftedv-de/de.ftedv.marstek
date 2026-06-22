// drivers/b2500/driver.js
const Homey = require('homey');

class B2500Driver extends Homey.Driver {
  async onInit() {
    this.homey.flow
      .getActionCard('set_output_power')
      .registerRunListener(async args => {
        return args.device.setOutputPower(args.power);
      });

    this.homey.flow
      .getConditionCard('battery_above')
      .registerRunListener(async args => {
        return args.device.isCapabilityAbove('measure_battery', args.value);
      });

    this.homey.flow
      .getConditionCard('pv_power_above')
      .registerRunListener(async args => {
        return args.device.isCapabilityAbove('marstek_pv_power', args.value);
      });

    this.homey.flow
      .getConditionCard('output_power_above')
      .registerRunListener(async args => {
        return args.device.isCapabilityAbove('marstek_output_power', args.value);
      });

    this.homey.flow
      .getConditionCard('output_enabled')
      .registerRunListener(async args => {
        return args.device.isOutputEnabled(args.output);
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
