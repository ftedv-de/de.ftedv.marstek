// drivers/b2500/device.js
const Homey = require('homey');
const protocols = require('../../lib/marstek/b2500/protocols');
function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
class B2500Device extends Homey.Device {
/* existing code unchanged */
isCapabilityAbove(capability, threshold){if(!this.hasCapability(capability)) return false; const value=Number(this.getCapabilityValue(capability)); const compareTo=Number(threshold); if(!Number.isFinite(value)||!Number.isFinite(compareTo)) return false; return value>compareTo;}
isCapabilityBelow(capability, threshold){if(!this.hasCapability(capability)) return false; const value=Number(this.getCapabilityValue(capability)); const compareTo=Number(threshold); if(!Number.isFinite(value)||!Number.isFinite(compareTo)) return false; return value<compareTo;}
}
module.exports = B2500Device;