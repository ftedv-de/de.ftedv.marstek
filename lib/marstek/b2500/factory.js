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
    store: {
      role: 'battery',
    },
    settings: {
      protocol_version: protocolVersion,
      mqtt_state_topic: `hame_energy/${normalizedModel}/device/${normalizedDeviceId}/ctrl`,
      mqtt_command_topic: `hame_energy/${normalizedModel}/App/${normalizedDeviceId}/ctrl`,
    },
  };
}

function buildB2500PvDevice({ model, deviceId, protocolVersion = 'v2' }) {
  const normalizedModel = normalizeModel(model);
  const normalizedDeviceId = normalizeDeviceId(deviceId);

  assertValidModel(normalizedModel);
  assertValidDeviceId(normalizedDeviceId);

  return {
    name: `Marstek ${normalizedModel} PV ${normalizedDeviceId}`,
    data: {
      id: `${normalizedModel}-${normalizedDeviceId}-pv`,
    },
    class: 'solarpanel',
    capabilities: [
      'measure_power',
      'meter_power',
      'marstek_pv1_power',
      'marstek_pv2_power',
    ],
    store: {
      role: 'pv',
      parentDeviceId: `${normalizedModel}-${normalizedDeviceId}`,
    },
    settings: {
      protocol_version: protocolVersion,
      mqtt_state_topic: `hame_energy/${normalizedModel}/device/${normalizedDeviceId}/ctrl`,
      mqtt_command_topic: `hame_energy/${normalizedModel}/App/${normalizedDeviceId}/ctrl`,
    },
  };
}

function buildB2500DeviceSet(options) {
  return {
    battery: buildB2500Device(options),
    pv: buildB2500PvDevice(options),
  };
}

module.exports = {
  assertValidDeviceId,
  assertValidModel,
  buildB2500Device,
  buildB2500DeviceSet,
  buildB2500PvDevice,
  normalizeDeviceId,
  normalizeModel,
};
