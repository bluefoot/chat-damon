var crypto = require('crypto');
const secret = 'eRkGa52dWXRlhnrcfFkYWlIHIv';
var exports = module.exports = {};
var validator = require('validator');

exports.die = function(msg) {
  console.log(msg);
  process.exit(1);
}

exports.hashpwd = function(pwd) {
  try {
    if(validator.isEmpty(pwd)) {
      return "";
    } else {
      return crypto.createHmac('sha256', secret).update(pwd).digest('hex');
    }
  } catch(err){
    return "";
  }
}