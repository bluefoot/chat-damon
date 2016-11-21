var cfenv = require('cfenv');
var appEnv = cfenv.getAppEnv();
var validator = require('validator');
var chatutils = require('./chatutils.js');
var mongo;

// Find out connection URI from environment or cfenv
var mongo_uri;
var vcap = appEnv.VCAP_SERVICES || process.env.VCAP_SERVICES;
if (vcap) {
  var env = JSON.parse(vcap);
  if (env['compose-for-mongodb'] && env['compose-for-mongodb'][0]) {
    mongo_uri = env['compose-for-mongodb'][0]['credentials']["uri"];
  } else {
    chatutils.die("Mongodb connection info not found in VCAP_SERVICES env variable");
  }
} else {
  chatutils.die("Cannot get VCAP_SERVICES env variable");
}
// Connect to mongodb and create bootstrap data
var bootstrapData = [
   {'userid':'gewton', 'password':'70888d3dcc9d934b847af076a3750363778121ade8c4bb92de49ee3daf8b09c7', 'name' : 'Gewton', 'email' : 'gewtont@gmail.com'}, //changeme
   {'userid':'jon', 'password':'70888d3dcc9d934b847af076a3750363778121ade8c4bb92de49ee3daf8b09c7', 'firstname' : 'Jon', 'email' : 'jsnow@somemail.com'},
   {'userid':'stantheman', 'password':'70888d3dcc9d934b847af076a3750363778121ade8c4bb92de49ee3daf8b09c7', 'firstname' : 'Stannis', 'email' : 'stan@somemail.com'},
   {'userid':'dovahkiin', 'password':'70888d3dcc9d934b847af076a3750363778121ade8c4bb92de49ee3daf8b09c7', 'firstname' : 'Dragon', 'email' : 'dovhakiin@somemail.com'},
   {'userid':'polt', 'password':'70888d3dcc9d934b847af076a3750363778121ade8c4bb92de49ee3daf8b09c7', 'firstname' : 'Choi', 'email' : 'polt@somemail.com'},
   {'userid':'byun', 'password':'70888d3dcc9d934b847af076a3750363778121ade8c4bb92de49ee3daf8b09c7', 'firstname' : 'Hyun', 'email' : 'byun@somemail.com'},
   {'userid':'maru', 'password':'70888d3dcc9d934b847af076a3750363778121ade8c4bb92de49ee3daf8b09c7', 'firstname' : 'Cho', 'email' : 'maru@somemail.com'},
   {'userid':'artosis', 'password':'70888d3dcc9d934b847af076a3750363778121ade8c4bb92de49ee3daf8b09c7', 'firstname' : 'Dan', 'email' : 'artosis@somemail.com'},
   {'userid':'tasteless', 'password':'70888d3dcc9d934b847af076a3750363778121ade8c4bb92de49ee3daf8b09c7', 'firstname' : 'Nick', 'email' : 'tasteless@somemail.com'},
   {'userid':'flash', 'password':'70888d3dcc9d934b847af076a3750363778121ade8c4bb92de49ee3daf8b09c7', 'firstname' : 'Lee', 'email' : 'flash@somemail.com'},
   {'userid':'zest', 'password':'70888d3dcc9d934b847af076a3750363778121ade8c4bb92de49ee3daf8b09c7', 'firstname' : 'Joo', 'email' : 'zest@somemail.com'},
   {'userid':'ty', 'password':'70888d3dcc9d934b847af076a3750363778121ade8c4bb92de49ee3daf8b09c7', 'firstname' : 'Jun', 'email' : 'ty@somemail.com'},
   {'userid':'hero', 'password':'70888d3dcc9d934b847af076a3750363778121ade8c4bb92de49ee3daf8b09c7', 'firstname' : 'Kim', 'email' : 'hero@somemail.com'},
   {'userid':'innovation', 'password':'70888d3dcc9d934b847af076a3750363778121ade8c4bb92de49ee3daf8b09c7', 'firstname' : 'Lee', 'email' : 'innovation@somemail.com'},
   {'userid':'apollo', 'password':'70888d3dcc9d934b847af076a3750363778121ade8c4bb92de49ee3daf8b09c7', 'firstname' : 'Shaun', 'email' : 'aspollo@somemail.com'},
   {'userid':'dragon', 'password':'70888d3dcc9d934b847af076a3750363778121ade8c4bb92de49ee3daf8b09c7', 'firstname' : 'Jeon', 'email' : 'ladydragon@somemail.com'}
];
require('mongodb').MongoClient.connect(mongo_uri, {
  mongos: {
      ssl: true,
      sslValidate: false
    }
  }, 
  function(err, db) {
    if(err) {
      chatutils.die("Cant connect to mongodb: " + err);
    }
    mongo = db.db("chat");
    console.log('Mongodb loaded');
    // Attempt to create users collection if doesn't exist
    mongo.createCollection('chat.users', function(err, collection) {
      // Insert bootstrap data if no user not present
      collection.findOne({}, function(err, item) {
        if(!item) {
          collection.insert(bootstrapData, {w:1}, function(err, result) {
            if(err) {
              console.log("Error loading bootstrap data: " + err);
            } else {
              console.log("Bootstrap data successfully loaded");
            }
          });
        }
      });
    });
  }
);

exports.isDbReady = function() {
  return typeof mongo != 'undefined';
}

exports.userFind = function(fields, callback) {
  mongo.collection('chat.users').findOne(fields, function(err, item) {
    if(callback) callback(err, item);
  });
}

/**
 * Inserts user and returns the full object
 */
exports.userInsert = function(user, callback) {
  for(var key in user) {
    user[key] = (''+user[key]).trim();   // the ''+ needed in case some values are not strings
  }
  user.password = chatutils.hashpwd(user.password);
  if(!userValidate(user)) {
    if(callback) callback("User not valid", null);
    return;
  }
  mongo.collection('chat.users').findOne({'$or':[{'userid':user.userid}, {'email':user.email}]}, function(err, item) {
    if(item) {
      var error = "Email already registered";
      if(item.userid==user.userid) {
        error = "User ID already registered";
      }
      if(callback) return callback(error, null);
    } else {
      mongo.collection('chat.users').insertOne(user, function(err, result) {
        if(err) throw err;
        exports.userFind({userid:user.userid}, function(errfind, resultfind){
          if(errfind) throw errfind;
          if(callback) return callback(err, resultfind);
        });
      });
    }
  });
}

exports.resetData = function(callback) {
  mongo.collection('chat.users', function(err, collection) {
    collection.drop({},function(err, removed){
      console.log("data was wiped");
      if(callback) callback(err, removed);
    });
  });
}

exports.displayUserData = function() {
  mongo.collection('chat.users').find().toArray(function(err, items) {
    if(!err) {
      console.log("users found:=========================");
      items.forEach(function(item) {
        console.log(item);
      });
      console.log("====================================");
    } else {
      console.log("can't get data to display: " + err);
    }
  });
}

function userValidate(user) {
  if(Object.keys(user).length!=4 ||
      validator.isEmpty(user.userid) ||
      validator.isEmpty(user.name) ||
      !validator.isEmail(user.email) ||
      validator.isEmpty(user.password) ||
      !validator.isAlphanumeric(user.userid)) {
    return false;
  }
  return true;
}
