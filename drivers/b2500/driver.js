// drivers/b2500/driver.js
const Homey = require('homey');

class B2500Driver extends Homey.Driver {
  async onInit() {
    this.homey.flow.getActionCard('update_status').registerRunListener(async args => args.device.updateStatus());

    this.homey.flow.getConditionCard('battery_above').registerRunListener(async args => args.device.isCapabilityAbove('measure_battery', args.value));
    this.homey.flow.getConditionCard('battery_below').registerRunListener(async args => args.device.isCapabilityBelow('measure_battery', args.value));

    this.homey.flow.getConditionCard('output_power_above').registerRunListener(async args => args.device.isOutputPowerAbove(args.value));
    this.homey.flow.getConditionCard('output_power_below').registerRunListener(async args => args.device.isOutputPowerBelow(args.value));

    this.homey.flow.getConditionCard('output_enabled').registerRunListener(async args => args.device.isOutputEnabled(args.output));

    this.log('B2500 driver initialized');
  }

  async onPair(session) {
    session.setHandler('probe_device', async data => {
      return this.homey.app.probeDevice(data);
    });
  }

  async onRepair(session, device) {
    session.setHandler('get_schedules', async () => {
      return device.getScheduleSlots();
    });

    session.setHandler('refresh_schedules', async () => {
      return device.refreshScheduleSlots();
    });

    session.setHandler('save_schedules', async data => {
      return device.saveUserScheduleSlots(data && data.slots ? data.slots : []);
    });
  }
}

module.exports = B2500Driver;
