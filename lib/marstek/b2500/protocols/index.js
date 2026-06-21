// lib/marstek/b2500/protocols/index.js
const V1 = require('./v1');
const V2 = require('./v2');

module.exports.create = function create(version) {
  switch (version) {
    case 'v1':
      return new V1();
    case 'v2':
      return new V2();
    default:
      throw new Error(`Unsupported B2500 protocol version: ${version}`);
  }
};
