// Fix BigInt serialization issue in Jest
global.BigInt.prototype.toJSON = function() {
  return this.toString()
}