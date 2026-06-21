// lib/marstek/b2500/factory.js
function normalizeModel(model) {
  return String(model || '').trim();
}

function normalizeDeviceId(deviceId) {
  return String(deviceId || '').trim().toLowerCase();
}

function assertValidModel(model) {
  if (!normalizeModel(model)) {
    throw new Error('Missing device model');
  }
}

function assertValidDeviceId(deviceId) {
  if (!/^[a-f0-9]{12}$/i.test(normalizeDeviceId(deviceId))) {
    throw new Error('Device ID must be a 12 character hexadecimal value');
  }
}

function buildB2500Device({ model, deviceId, protocolVersion = 'v2' }) {
  const normalizedModel = normalizeModel(model);
  const normalizedDeviceId = normalizeDeviceId(deviceId);

  assertValidModel(normalizedModel);
  assertValidDeviceId(normalizedDeviceId);

  return {
    name: `Marstek ${normalizedModel} ${normalizedDeviceId}`,
    data: {
      id: `${normalizedModel}-${normalizedDeviceId}`,
    },
    settings: {
      protocol_version: protocolVersion,
      mqtt_state_topic: `hame_energy/${normalizedModel}/device/${normalizedDeviceId}/ctrl`,
      mqtt_command_topic: `hame_energy/${normalizedModel}/App/${normalizedDeviceId}/ctrl`,
    },
  };
}

module.exports = {
  assertValidDeviceId,
  assertValidModel,
  buildB2500Device,
  normalizeDeviceId,
  normalizeModel,
};
