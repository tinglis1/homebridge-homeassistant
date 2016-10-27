"use strict";
var Service, Characteristic, communicationError;

module.exports = function (oService, oCharacteristic, oCommunicationError) {
  Service = oService;
  Characteristic = oCharacteristic;
  communicationError = oCommunicationError;

  return HomeAssistantSensorFactory;
};

function HomeAssistantSensorFactory(log, data, client) {
  if (!data.attributes) {
    return null;
  }
  var service, characteristic, transformData;
  if (data.attributes.unit_of_measurement === '°C' || data.attributes.unit_of_measurement === '°F') {
    service = Service.TemperatureSensor;
    characteristic = Characteristic.CurrentTemperature;
    transformData = function(data) {
      var value = parseFloat(data.state);
      // HomeKit only works with Celsius internally
      if (data.attributes.unit_of_measurement === '°F') {
        value = (value - 32) / 1.8;
      }
      return value;
    };
  } else if (data.attributes.unit_of_measurement === "%" && data.entity_id.includes("humidity")) {
    service = Service.HumiditySensor;
    characteristic = Characteristic.CurrentRelativeHumidity;
  } else if (data.attributes.unit_of_measurement === "lux") {
    service = Service.LightSensor;
    characteristic = Characteristic.CurrentAmbientLightLevel;
    transformData = function(data) {
      return Math.max(0.0001, parseFloat(data.state));
    };
  } else {
    return null;
  }

  return new HomeAssistantSensor(log, data, client, service, characteristic, transformData);
}

class HomeAssistantSensor {
  constructor(log, data, client, service, characteristic, transformData) {
    // device info
    this.data = data;
    this.entity_id = data.entity_id;
    if (data.attributes && data.attributes.friendly_name) {
      this.name = data.attributes.friendly_name;
    }else{
      this.name = data.entity_id.split('.').pop().replace(/_/g, ' ');
    }

    this.entity_type = data.entity_id.split('.')[0];

    this.client = client;
    this.log = log;

    this.service = service;
    this.characteristic = characteristic;
    if (transformData) {
      this.transformData = transformData;
    }
  }

  transformData(data) {
    return parseFloat(data.state);
  }

  onEvent(old_state, new_state) {
    this.sensorService.getCharacteristic(this.characteristic)
      .setValue(this.transformData(new_state), null, 'internal');
  }

  identify(callback){
    this.log("identifying: " + this.name);
    callback();
  }

  getState(callback){
    this.log("fetching state for: " + this.name);
    this.client.fetchState(this.entity_id, function(data) {
      if (data) {
        callback(null, this.transformData(data));
      }else{
        callback(communicationError);
      }
    }.bind(this));
  }

  getServices() {
    this.sensorService = new this.service();
    var informationService = new Service.AccessoryInformation();

    informationService
      .setCharacteristic(Characteristic.Manufacturer, "Home Assistant")
      .setCharacteristic(Characteristic.Model, "Sensor")
      .setCharacteristic(Characteristic.SerialNumber, "xxx");

    this.sensorService
      .getCharacteristic(this.characteristic)
      .on('get', this.getState.bind(this));

    return [informationService, this.sensorService];
  }
}

module.exports.HomeAssistantSensorFactory = HomeAssistantSensorFactory;
