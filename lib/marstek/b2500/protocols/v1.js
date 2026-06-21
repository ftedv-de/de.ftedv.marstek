// lib/marstek/b2500/protocols/v1.js
const { parseKeyValuePayload } = require('./common/parser');
const { mapState } = require('./common/mapper');

class B2500ProtocolV1 {
  parseState(payload) {
    const data = parseKeyValuePayload(payload);
    return mapState(data);
  }

  readState() {
    return 'cd=01';
  }

  setChargeMode(mode) {
    return `cd=03,md=${mode}`;
  }

  setDischargeMode(mode) {
    return `cd=04,md=${mode}`;
  }

  setDod(percent) {
    return `cd=05,md=${percent}`;
  }

  setOutputThreshold(watts) {
    return `cd=06,md=${watts}`;
  }

  setTimerSchedule(commandBody) {
    return `cd=07,${commandBody}`;
  }

  syncTime(body) {
    return `cd=08,${body}`;
  }

  setTimezone(offsetMinutes) {
    return `cd=09,wy=${offsetMinutes}`;
  }

  restart() {
    return 'cd=10';
  }

  factoryReset() {
    return 'cd=11';
  }
}

module.exports = B2500ProtocolV1;
