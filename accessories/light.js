var Service, Characteristic, communicationError;

module.exports = function (oService, oCharacteristic, oCommunicationError) {
  Service = oService;
  Characteristic = oCharacteristic;
  communicationError = oCommunicationError;

  return HomeAssistantLight;
};
module.exports.HomeAssistantLight = HomeAssistantLight;

function HomeAssistantLight(log, data, client) {
  // device info
  this.domain = "light"
  this.data = data
  this.entity_id = data.entity_id
  this.supports_color = false

  if (data.attributes && data.attributes.friendly_name) {
    this.name = data.attributes.friendly_name
  }else{
    this.name = data.entity_id.split('.').pop().replace(/_/g, ' ')
  }

  if (data.attributes && data.attributes.rgb_color) {
    this.supports_color = true
  }

  this.client = client
  this.log = log;
}

HomeAssistantLight.prototype = {
  identify: function(callback){
    this.log("identifying: " + this.name);

    var that = this;
    var service_data = {}
    service_data.entity_id = this.entity_id
    service_data.flash = 'short'

    this.client.callService(this.domain, 'turn_on', service_data, function(data){
      if (data) {
        that.log("Successfully identified '"+that.name+"'");
      }
      callback()
    }.bind(this))
  },
  getPowerState: function(callback){
    this.log("fetching power state for: " + this.name);

    this.client.fetchState(this.entity_id, function(data){
      if (data) {
        powerState = data.state == 'on'
        callback(null, powerState)
      }else{
        callback(communicationError)
      }
    }.bind(this))
  },
  getBrightness: function(callback){
    this.log("fetching brightness for: " + this.name);

    this.client.fetchState(this.entity_id, function(data){
      if (data && data.attributes) {
        brightness = ((data.attributes.brightness || 0) / 255)*100
        callback(null, brightness)
      }else{
        callback(communicationError)
      }
    }.bind(this))
  },
  getHue: function(callback){
    this.log("fetching hue for: " + this.name);

    this.client.fetchState(this.entity_id, function(data){
      if (data && data.attributes) {
        hue = data.attributes.rgb_color
        callback(null, hue)
      }else{
        callback(communicationError)
      }
    }.bind(this))
  },
  setPowerState: function(powerOn, callback) {
    var that = this;
    var service_data = {}
    service_data.entity_id = this.entity_id

    if (powerOn) {
      this.log("Setting power state on the '"+this.name+"' to on");

      this.client.callService(this.domain, 'turn_on', service_data, function(data){
        if (data) {
          that.log("Successfully set power state on the '"+that.name+"' to on");
          callback()
        }else{
          callback(communicationError)
        }
      }.bind(this))
    }else{
      this.log("Setting power state on the '"+this.name+"' to off");

      this.client.callService(this.domain, 'turn_off', service_data, function(data){
        if (data) {
          that.log("Successfully set power state on the '"+that.name+"' to off");
          callback()
        }else{
          callback(communicationError)
        }
      }.bind(this))
    }
  },
  setBrightness: function(level, callback) {
    var that = this;
    var service_data = {}
    service_data.entity_id = this.entity_id

    service_data.brightness = 255*(level/100.0)

    this.log("Setting brightness on the '"+this.name+"' to " + level);

    this.client.callService(this.domain, 'turn_on', service_data, function(data){
      if (data) {
        that.log("Successfully set brightness on the '"+that.name+"' to " + level);
        callback()
      }else{
        callback(communicationError)
      }
    }.bind(this))
  },
  getServices: function() {
    var lightbulbService = new Service.Lightbulb();
    var informationService = new Service.AccessoryInformation();

    informationService
      .setCharacteristic(Characteristic.Manufacturer, "Home Assistant")
      .setCharacteristic(Characteristic.Model, "Light")
      .setCharacteristic(Characteristic.SerialNumber, "xxx");

    lightbulbService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getPowerState.bind(this))
      .on('set', this.setPowerState.bind(this));

    lightbulbService
      .addCharacteristic(Characteristic.Brightness)
      .on('get', this.getBrightness.bind(this))
      .on('set', this.setBrightness.bind(this));

    if (this.supports_color) {
      lightbulbService
        .addCharacteristic(Characteristic.Hue)
        .on('get', this.getHue.bind(this))
        .on('set', this.setHue.bind(this));
    }

    return [informationService, lightbulbService];
  }

}
