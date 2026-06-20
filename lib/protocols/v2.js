// lib/marstek/protocols/v2.js
const MarstekProtocolV1 = require('./v1');

class MarstekProtocolV2 extends MarstekProtocolV1 {
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

module.exports = MarstekProtocolV2;