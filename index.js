// requestss
var logger = require('minilogger');
var request = require('request');
var fs = require('fs');
var log = new logger();

// 'public' variables
var schema = {};
var pricelist = {};
var schemaByDefindex = {};
var getAttribute = {};

var callAPI = function (url, callback) {
  request.get(
    {
      pool:{
        maxSockets: 500
      },
      uri: url,
      timeout: 1000*5
    },
    function (error, response, body) {
	if ((error != null) || (response.statusCode != 200) || (response == null)) {
	    log.error('call failed, retrying ' + error);
	    callAPI(url, callback);
	    return;
	} else {
	    try {
            log.info('call success')
            var result = JSON.parse(body);
          } catch (e) {
            log.error('error parsing the api call');
            callAPI(url, callback);
            return;
          }
          callback(result);
	}
    }
  );
};

var getAttributes = function (schema) {
  for (var i = schema.attribute_controlled_attached_particles.length - 1; i >= 0; i--) {
    getAttribute[schema.attribute_controlled_attached_particles[i].id] = schema.attribute_controlled_attached_particles[i];
    log.debug(getAttribute[36].name);
  }
  log.debug('attributes created');
  return getAttribute;
};

var getSchemaItem = function (item) {
  return schemaByDefindex[item.defindex];
};
var createSchemaByDef = function (schema) {
  for (var i = schema.items.length - 1; i >= 0; i--) {
    schemaByDefindex[schema.items[i].defindex] = schema.items[i];
  }
};

var createItemById = function (inv) {
  var itemById = {};
  for (var i = inv.items.length -1; i >= 0; i--) {
    itemById[inv.items[i].id] = inv.items[i];
  }
  return itemById;
};

var getItemPrice = function (itemInfo) {
  var schemaItem = getSchemaItem(itemInfo);
  var itemname = schemaItem.item_name;
  if (schemaItem.item_class == "supply_crate") {
    for (var i = schemaItem.attributes.length -1; i >= 0 ; i--) {
      if (schemaItem.attributes[i]["class"] == "supply_crate_series") {
        priceindex = schemaItem.attributes[i].value;
      }
    }
  } else if (itemname == "Chemistry Set") {
    if (itemInfo.attributes[0].quality == 14) {
      itemname == "Collectors " + schemaByDefindex[itemInfo.attributes[0].itemdef].item_name + " " + itemname;
    } else {
      
    }
  }
   
  
  else if (
             (itemname.indexOf('Fabricator') > -1) ||
             (itemname.indexOf('Strangifier') > -1)
             ) {
    //code
  }
};

var insertPriceAlternates = function (prices) {
	var pricesKeys = Object.keys(prices);
	for (var i = pricesKeys.length - 1; i >= 0; i--) {
		if( prices[pricesKeys[i]].hasOwnProperty('alt_defindex') ) {
			var defAlts = Object.keys(prices[pricesKeys[i]].alt_defindex);
			for (var j = defAlts.length - 1; j >= 0; j--) {
				prices[prices[pricesKeys[i]].alt_defindex[defAlts[j].toString()]] = prices[pricesKeys[i]]
			};
		}
	};
	return prices;
};
 
//synchronous function - find specific item price
	//defindex = number of defindex to get prices of
	//quality = number of quality
	//priceindex = {cratenumber -or- unusual effect number }else{ 0 }
var getSpecificPrice = function (defindex, quality, priceindex) {
	try {
		var itemCurrent = prices[defindex][quality][priceindex].current;
	} catch (e) {
		return { unit:'', value:'N/A' }
	}
	if(itemCurrent.currency == 'usd' && exchange != null) {
		itemCurrent = convertCurrency({unit: itemCurrent.currency, value: itemCurrent.value}, 'earbuds')
	}
	var itemValue = itemCurrent.value.toFixed(2);
	var itemUnit = itemCurrent.currency || itemCurrent.unit;
	return { unit: itemUnit, value: itemValue };
};

var convertCurrency = function (price, newCurr) {
	if(price.value != 'N/A') {
		return {unit: newCurr, value: (price.value * exchange[price.unit][newCurr])};
	} else {
		return {unit: newCurr, value: 'N/A'};
	}
};

var getInventoryWorth = function (inv) {
	var total = {
		metal: 0,
		keys: 0,
		earbuds: 0,
		usd: 0
	};

	for (var i = inv.items.length - 1; i >= 0; i--) {
		var itemPrice = getItemPrice(inv.items[i]);
		itemPrice = convertCurrency(itemPrice, 'metal');

		if(typeof itemPrice.value == 'number') {
			total.metal += itemPrice.value;
		}
	};

	for (var i = Object.keys(total).length - 1; i >= 0; i--) {
		total[Object.keys(total)[i]] = convertCurrency({
			unit: 'metal',
			value: total.metal
		}, Object.keys(total)[i])
	};

	return total;
};

var updateCurrencyValues = function () {
	var refined = 5002;
	var key = 5021;
	var earbuds = 143;
	var currencies = {};

	var usdinref = getSpecificPrice(refined,6,0).value
	var refinkey = getSpecificPrice(key,6,0).value
	var keyinbud = getSpecificPrice(earbuds,6,0).value
	currencies = {
		'metal': {
			'metal': 1,
			'keys': 1/refinkey,
			'usd': usdinref,
			'earbuds': 1/(refinkey*keyinbud)
		},
		'keys': {
			'metal': refinkey,
			'keys': 1,
			'usd': refinkey*usdinref,
			'earbuds': 1/keyinbud
		},
		'usd': {
			'metal': 1/usdinref,
			'keys': 1/(usdinref*refinkey),
			'usd': 1,
			'earbuds': 1/(usdinref*refinkey*keyinbud)
		},
		'earbuds': {
			'metal': refinkey*keyinbud,
			'keys': keyinbud,
			'usd': usdinref*refinkey*keyinbud,
			'earbuds': 1						
		},
		'N/A': {
			'metal': 1,
			'keys': 1,
			'usd': 1,
			'earbuds': 1						
		}
	};
	log.info('Currency exchange updated');
	return currencies;
};

var createLookups = function (schema, callback) {
	schemaByDefindex = {};
	for (var i = schema.items.length - 1; i >= 0; i--) {
		schemaByDefindex[schema.items[i].defindex] = schema.items[i];
	};

	qualitiesByIndex = {};
	for (var i = Object.keys(schema.qualities).length - 1; i >= 0; i--) {
		qualitiesByIndex[schema.qualities[Object.keys(schema.qualities)[i]]] = schema.qualityNames[Object.keys(schema.qualities)[i]];
	};

	originsByIndex = {};
	for (var i = schema.originNames.length - 1; i >= 0; i--) {
		originsByIndex[schema.originNames[i].origin] = schema.originNames[i].name;
	};

	attributesByDefindex = {};
	for (var i = schema.attributes.length - 1; i >= 0; i--) {
		attributesByDefindex[schema.attributes[i].defindex] = schema.attributes[i];
	};

	particlesByIndex = {};
	for (var i = schema.attribute_controlled_attached_particles.length - 1; i >= 0; i--) {
		particlesByIndex[schema.attribute_controlled_attached_particles[i].id] = schema.attribute_controlled_attached_particles[i];
	};
	callback();
};

var loadBPTF = function (apikey, force, callback) {
  var bptfURL = "http://backpack.tf/api/IGetPrices/v4/?key="+ apikey;
  var cache = './bptf.cache';
  if (force) {
    if (fs.existsSync(cache)) {
      fs.unlinkSync(cache);
    }
    log.info('Downloading bptf prices');
    callAPI(bptfURL, function(result) {
      pricelist = result.response;
      fs.writeFileSync(cache, JSON.stringify(pricelist));
      callback(pricelist);
      return;
    });
  } else {
    try {
      pricelist = JSON.parse(fs.readFileSync(cache));
      log.info('Price list parsed ' + cache);
    } catch (e) {
      log.error('Price list parsing error, retrying');
      log.error(e.message);
      loadBPTF(apikey, true, callback);
      return;
    }
    callback(pricelist);
    return;
  }
};

var loadTF2Schema = function (apikey, lang, force, callback) {
  var schemaURL = "http://api.steampowered.com/IEconItems_440/GetSchema/v0001/?key=" + apikey + "&language=" + lang;
  log.info(schemaURL);
  var cache = './schema.cache';
  if (force) {
    if (fs.existsSync(cache)) {
      fs.unlinkSync(cache);
    }
    log.info('Downloading schema');
    callAPI(schemaURL, function(result) {
      schemaD = result.result;
      fs.writeFileSync(cache, JSON.stringify(schemaD));
      callback(schemaD);
      return;
    });
  } else {
    try {
      schemaD = JSON.parse(fs.readFileSync(cache));
      log.info('Schema parsed '+cache);
		} catch (e) {
      log.error("Schema error, retrying parser");
			log.error(e.message);
			loadSchema(apikey, game, lang, true, callback);	
			return;
		}
    callback(schemaD);
    return;
  }
};

var loadCSGOSchema = function (apikey, lang, force, callback) {
  var schemaURL = "http://api.steampowered.com/IEconItems_730/GetSchema/v2/?key=" + apikey + "&language=" + lang;
  log.info(schemaURL);
  var cache = './schemacsgo.cache';
  if (force) {
    if (fs.existsSync(cache)) {
      fs.unlinkSync(cache);
    }
    log.info('Downloading schema');
    callAPI(schemaURL, function(result) {
      schemaD = result.result;
      fs.writeFileSync(cache, JSON.stringify(schemaD));
      callback(schemaD);
      return;
    });
  } else {
    try {
      schemaD = JSON.parse(fs.readFileSync(cache));
      log.info('Schema parsed '+cache);
		} catch (e) {
      log.error("Schema error, retrying parser");
			log.error(e.message);
			loadSchema(apikey, game, lang, true, callback);	
			return;
		}
    callback(schemaD);
    return;
  }
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

var isP2P = function (inventory) {
	var P2P = false;
	if(inventory.num_backpack_slots >= 300){
		P2P = true;
	}
	return P2P;
};

exports.isP2P = isP2P;
exports.loadTF2Schema = loadTF2Schema;
exports.loadCSGOSchema = loadCSGOSchema;
exports.loadInventory = loadInventory;
exports.loadFriends = loadFriends;
exports.loadBPTF = loadBPTF;
exports.getItemPrice = getItemPrice;
exports.getSpecificPrice = getSpecificPrice;
exports.updateCurrencyValues = updateCurrencyValues;
exports.convertCurrency = convertCurrency;
exports.getAttributes = getAttributes;