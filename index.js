var logger = require('minilogger');
var request = require('request');
var fs = require('fs');

var log = new logger();

var callAPI = function (url, callback) {
  request.get(
    {
      pool:{
        maxSockets: 500
      },
      uri: url,
      timeout: 1000*20
    },
    function (error, response, body) {
      if ((response != null) && (response.result != undefined)) {
        if (response.statusCode == 200) {
          try {
            var result = JSON.parse(body);
          } catch (e) {
            log.error('error parsing the api call');
            callAPI(url, callback);
            return;
          }
          callback(result);
        } else if (response.statusCode == 500) {
          callAPI(url, callback);
          return;
        } else {
          log.error('status code: ') + response.statusCode;
          callAPI(url, callback);
          return;
        }
      } else {
        callAPI(url, callback);
        return;
      }
    }
  )
};

// callbacks the schema
  // game = game for the one you want to load the schema (steamapp id)
  // apikey = your steam api key
  // lang = the language you want the schema to be in
var loadSchema = function (apikey, game, lang, callback) {
  var schemaURL = "http://api.steampowered.com/IEconItems_" + game + "/GetSchema/v0001/?key=" + apikey + "&language=" + lang;
  log.info('Downloading schema');
  callAPI(schemaURL, function(result) {
    schema = result.result;
    return schema;
  });
};

var loadInventory = function (apikey, game, sid, callback) {
  var invURL = "http://api.steampowered.com/IEconItems_"+ game +"/GetPlayerItems/v0001/?key=" + apikey + "&steamid=" + sid + "&inventory=yes";
  log.info('Downloading inventory: ' + sid);
  callAPI(invURL, function (result) {
			inventory = result.result;
			callback(inventory, sid);
			return;
		});
};

var loadFriends = function (apikey, sid, calback) {
  var friendURL = "http://api.steampowered.com/ISteamUser/GetFriendList/v0001/?key="+ apikey + "&steamid="+ sid +"&relationship=friend";
  callAPI(friendURL, function (result) {
			friends = result.friendlist.friends;
			callback(friends, sid);
			return;
		});
};

exports.loadSchema = loadSchema;
exports.loadInventory = loadInventory;
exports.loadFriends = loadFriends;