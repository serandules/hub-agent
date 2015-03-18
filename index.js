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

    socket.on('connect', function () {
        log.info('connected hub %s', ns);
    });

    done(false, socket);
};

var config;

var queue = [];

var conf = function (name, done) {
    var id = uuid.v4();
    config.emit(config, id, name);
    config.once(id, function (value) {
        done(value);
    });
};

agent('/configs', function (err, io) {
    io.once('connection', function () {
        config = io;
        queue.forEach(function (done) {
            done(conf);
        });
    });
});

module.exports = agent;

module.exports.config = function (done) {
    config ? done(conf) : queue.push(done);
};

