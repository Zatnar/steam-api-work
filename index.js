// requestss
var logger = require('minilogger');
var request = require('request');
var fs = require('fs');
var log = new logger();

// 'public' variables
var schema = {};
var pricelist = {};
var schemaByDefindex = {};
var qualitiesByIndex = {};
var originsByIndex = {};
var attributesByDefindex = {};
var particlesByIndex = {};
var callAPI = function(url, shit, callback) {
    if (shit <= 10) {
	callback(null);
	return;
    }
    request.get({
	pool: {
	    maxSockets: 500
	},
	uri: url,
	timeout: 1000 * 7
    }, function(error, response, body) {
	if (response != null || response.result != undefined) {
	    if (response.statusCode == 200) {
		try {
		    log.info('call success')
		    var result = JSON.parse(body);
		} catch (e) {
		    log.error('error parsing the api call');
		    callAPI(url, shit++, callback);
		    return;
		}
		callback(result);
	    } else if (response.statusCode == 500) {
		callAPI(url, shit++, callback);
		return;
	    } else {
		log.error('status code: ') + response.statusCode;
		callAPI(url, shit++, callback);
		return;
	    }
	} else {
	    callAPI(url, shit++, callback);
	    return;
	}
    });
};
var loadBPTF = function(apikey, force, callback) {
    var bptfURL = "http://backpack.tf/api/IGetPrices/v4/?key=" + apikey;
    var cache = './bptf.cache';
    if (force) {
	if (fs.existsSync(cache)) {
	    fs.unlinkSync(cache);
	}
	log.info('Downloading bptf prices');
	callAPI(bptfURL, 0, function(result) {
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

var loadSchema = function(apikey, game, lang, force, callback) {
    var schemaURL = "http://api.steampowered.com/IEconItems_" + game + "/GetSchema/v0001/?key=" + apikey + "&language=" + lang;
    log.info(schemaURL);
    var cache = './schema.cache';
    if (force) {
	if (fs.existsSync(cache)) {
	    fs.unlinkSync(cache);
	}
	log.info('Downloading schema');
	callAPI(schemaURL, 0, function(result) {
	    schema = result.result;
	    fs.writeFileSync(cache, JSON.stringify(schema));
	    callback(schema);
	    createLookups(schema, function() {
		log.info('lookups created');
	    });
	    return;
	});
    } else {
	try {
	    schema = JSON.parse(fs.readFileSync(cache));
	    log.info('Schema parsed ' + cache);
	} catch (e) {
	    log.error("Schema error, retrying parser");
	    log.error(e.message);
	    loadSchema(apikey, game, lang, true, callback);
	    return;
	}
	callback(schema);
	createLookups(schema, function() {
	    log.info('lookups created');
	});
	return;
    }
};

var createLookups = function(schema, callback) {
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

var loadInventory = function(apikey, game, sid, callback) {
    var invURL = "http://api.steampowered.com/IEconItems_" + game + "/GetPlayerItems/v0001/?key=" + apikey + "&steamid=" + sid + "&inventory=yes";
    log.info('Downloading inventory: ' + sid);
    callAPI(invURL, 0, function(result) {
	if (result == null) {
	    callback(null, null, false);
	    return;
	} else {
	    inventory = result.result;
	    callback(inventory, sid, true);
	    return;
	}
    });
};

var loadFriends = function(apikey, sid, calback) {
    var friendURL = "http://api.steampowered.com/ISteamUser/GetFriendList/v0001/?key=" + apikey + "&steamid=" + sid + "&relationship=friend";
    callAPI(friendURL, 0, function(result) {
	if (result == null) {
	    callback(null, null, false);
	    return;
	} else {
	    friends = result.friendlist.friends;
	    callback(friends, sid, true);
	    return;
	}
    });
};

var getSchemaItem = function(item) {
    return schemaByDefindex[item.defindex];
};

var getItemPrice = function(invItem) {
    var priceindex = 0;
    var schemaItem = getSchemaItem(invItem)
    if (schemaItem.item_class == "supply_crate") {
	for (var i = schemaItem.attributes.length - 1; i >= 0; i--) {
	    if (schemaItem.attributes[i]["class"] == "supply_crate_series") {
		priceindex = schemaItem.attributes[i].value;
	    }
	}
    } else if ((invItem.quality == 5) && (invItem.defindex != 266) && (invItem.defindex != 267)) {
	try {
	    priceindex = getUnusualEffectItem(invItem).id; //could improve by removing if statement and handling error
	} catch (e) {
	    priceindex = 0;
	}
    } else if (test) {
	//code
    }
    return getSpecificPrice(invItem.defindex, invItem.quality, priceindex);
};

var insertPriceAlternates = function(prices) {
    var pricesKeys = Object.keys(prices);
    for (var i = pricesKeys.length - 1; i >= 0; i--) {
	if (prices[pricesKeys[i]].hasOwnProperty('alt_defindex')) {
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
var getSpecificPrice = function(defindex, quality, priceindex) {
    try {
	var itemCurrent = prices[defindex][quality][priceindex].current;
    } catch (e) {
	return {
	    unit: '',
	    value: 'N/A'
	}
    }
    if (itemCurrent.currency == 'usd' && exchange != null) {
	itemCurrent = convertCurrency({
	    unit: itemCurrent.currency,
	    value: itemCurrent.value
	}, 'earbuds')
    }
    var itemValue = itemCurrent.value.toFixed(2);
    var itemUnit = itemCurrent.currency || itemCurrent.unit;
    return {
	unit: itemUnit,
	value: itemValue
    };
};

var convertCurrency = function(price, newCurr) {
    if (price.value != 'N/A') {
	return {
	    unit: newCurr,
	    value: (price.value * exchange[price.unit][newCurr])
	};
    } else {
	return {
	    unit: newCurr,
	    value: 'N/A'
	};
    }
};

var getInventoryWorth = function(inv) {
    var total = {
	metal: 0,
	keys: 0,
	earbuds: 0,
	usd: 0
    };

    for (var i = inv.items.length - 1; i >= 0; i--) {
	var itemPrice = getItemPrice(inv.items[i]);
	itemPrice = convertCurrency(itemPrice, 'metal');

	if (typeof itemPrice.value == 'number') {
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

var updateCurrencyValues = function() {
    var refined = 5002;
    var key = 5021;
    var earbuds = 143;
    var currencies = {};

    var usdinref = getSpecificPrice(refined, 6, 0).value
    var refinkey = getSpecificPrice(key, 6, 0).value
    var keyinbud = getSpecificPrice(earbuds, 6, 0).value
    currencies = {
	'metal': {
	    'metal': 1,
	    'keys': 1 / refinkey,
	    'usd': usdinref,
	    'earbuds': 1 / (refinkey * keyinbud)
	},
	'keys': {
	    'metal': refinkey,
	    'keys': 1,
	    'usd': refinkey * usdinref,
	    'earbuds': 1 / keyinbud
	},
	'usd': {
	    'metal': 1 / usdinref,
	    'keys': 1 / (usdinref * refinkey),
	    'usd': 1,
	    'earbuds': 1 / (usdinref * refinkey * keyinbud)
	},
	'earbuds': {
	    'metal': refinkey * keyinbud,
	    'keys': keyinbud,
	    'usd': usdinref * refinkey * keyinbud,
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

var isP2P = function(inventory) {
    var P2P = false;
    if (inventory.num_backpack_slots >= 300) {
	P2P = true;
    }
    return P2P;
};

exports.isP2P = isP2P;
exports.loadSchema = loadSchema;
exports.loadInventory = loadInventory;
exports.loadFriends = loadFriends;
exports.loadBPTF = loadBPTF;
exports.getItemPrice = getItemPrice;
exports.getSpecificPrice = getSpecificPrice;
exports.updateCurrencyValues = updateCurrencyValues;
exports.convertCurrency = convertCurrency;
exports.getAttributes = getAttributes;