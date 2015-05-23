var log = require('logger')('hub-agent');
var fs = require('fs');
var uuid = require('node-uuid');
var https = require('https');
var io = require('socket.io-client');

var configs = require('hub-configs');

var agent = function (ns, done) {
    var agent = new https.Agent({
        key: fs.readFileSync(configs.ssl.key),
        cert: fs.readFileSync(configs.ssl.cert),
        ca: [fs.readFileSync(configs.ssl.ca)]
    });

    var socket = io('wss://' + configs.domain + ':' + configs.port + ns, {
        transports: ['websocket'],
        agent: agent,
        query: 'token=' + configs.token
    });

    socket.once('connect', function () {
        log.info('connected hub %s', ns);
        done(false, socket);
    });
};

var config;

var queue = [];

var confs = function (name, done) {
    var id = uuid.v4();
    config.emit('config', id, name);
    config.once(id, function (value) {
        done(value);
    });
};

agent('/configs', function (err, io) {
    config = io;
    queue.forEach(function (o) {
        confs(o.name, o.done);
    });
});

module.exports = agent;

module.exports.config = function (name, done) {
    if (!config) {
        return queue.push({
            name: name,
            done: done
        });
    }
    confs(name, done);
};

