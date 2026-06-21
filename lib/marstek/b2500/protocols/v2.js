// lib/marstek/b2500/protocols/v2.js
const B2500ProtocolV1 = require('./v1');

class B2500ProtocolV2 extends B2500ProtocolV1 {
  setChargeMode(mode) {
    return `cd=17,md=${mode}`;
  }

  setDischargeMode(mode) {
    return `cd=18,md=${mode}`;
  }

  setDod(percent) {
    return `cd=19,md=${percent}`;
  }

  setTimerSchedule(commandBody) {
    return `cd=20,${commandBody}`;
  }
}

module.exports = B2500ProtocolV2;
