// drivers/b2500-pv/driver.js
const Homey = require('homey');

class B2500PvDriver extends Homey.Driver {
  async onInit() {
    this.log('B2500 PV companion driver initialized');
  }
}

module.exports = B2500PvDriver;
