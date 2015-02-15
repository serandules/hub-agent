var log = require('logger')('hub-agent');
var channel = require('./lib/channel');
var clustor = require('./lib/cluster');
var hubber = require('./lib/hubber');

module.exports.cluster = clustor;

module.exports.channel = channel;

module.exports.start = hubber.start;

module.exports.stop = hubber.stop;

module.exports.restart = hubber.restart;