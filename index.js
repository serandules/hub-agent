var debug = require('debug')('serandules:hub-agent');
var cluster = require('cluster');
var http = require('http');
var proxy = require('proxy');
var uuid = require('node-uuid');

var cpus = require('os').cpus().length;

var configs = {};

var workers = [];

var queue = {};

module.exports = function (run) {
    if (cluster.isWorker) {
        run();
        return;
    }
    // Fork workers.
    var worker;
    for (var i = 0; i < cpus; i++) {
        worker = cluster.fork();
        worker.on('message', (function (worker) {
            return function (data) {
                /*if (data.event !== 'drone configed') {
                 return;
                 }
                 debug('event:drone configed id:' + data.id);
                 var fn = configs[data.id];
                 fn(data.value);
                 delete configs[data.id];*/
                debug('++++++++++++++++++++++++++++' + data.id + ' ' + data.event);
                queue[data.id] = worker;
                process.send(data);
            };
        }(worker)));
        workers.push(worker);
    }
    cluster.on('exit', function (worker, code, signal) {
        debug('worker ' + worker.process.pid + ' died');
    });
    cluster.on('listening', function (worker, address) {
        if (--cpus > 0) {
            debug('worker started listening');
            return;
        }
        if (!process.send) {
            return;
        }
        var broadcast = function (data) {
            workers.forEach(function (worker) {
                worker.send(data);
            });
        };
        process.on('message', function (data) {
            debug('++++++++++++++++++++++++++++--------------------============================' + data.id + ' ' + data.event);
            var id;
            switch (data.event) {
                case 'drone configed':
                    id = data.id;
                    debug('event:drone configed id:' + id);
                    var fn = configs[id];
                    fn(data.value);
                    delete configs[id];
                    break;
                case 'drone init':
                    broadcast(data);
                    break;
                case 'drone joined':
                    broadcast(data);
                    break;
                case 'drone left':
                    broadcast(data);
                    break;
                case 'self domain':
                    broadcast(data);
                    break;
                default:
            }
        });
        process.send({
            event: 'drone started',
            address: address,
            pid: process.pid
        });
        debug('drone is advertised ' + address.address + ':' + address.port);
    });
};

module.exports.proxy = function () {
    var self;
    var allowed = {};

    var join = function (drone) {
        var domain = drone.domain;
        if (domain.indexOf('*.') === 0) {
            debug('load balancing drone : ' + domain);
            domain = domain.substring(2);
            debug('domain : ' + domain + ' self : ' + self);
            if (self === domain) {
                debug('self domain, skipping proxying');
                return allowed;
            }
        } else if (self !== domain) {
            debug('non-self non load balancing drone, skipping proxying');
            return allowed;
        }
        var o = allowed[domain] || (allowed[domain] = []);
        var drn = {
            id: drone.id,
            ip: drone.ip,
            port: drone.port
        };
        o.push(drn);
        debug('adding drone for load balancing');
        debug(drn);
        return allowed;
    };

    var left = function (drone) {
        var domain = drone.domain;
        if (domain.indexOf('*.') === 0) {
            debug('load balancing drone : ' + domain);
            domain = domain.substring(2);
            debug('domain : ' + domain + ' self : ' + self);
            if (self === domain) {
                debug('self domain, skipping proxying');
                return allowed;
            }
        } else if (self !== domain) {
            debug('non-self non load balancing drone, skipping proxying');
            return allowed;
        }
        var i, o;
        var drones = allowed[domain] || (allowed[domain] = []);
        var length = drones.length;
        for (i = 0; i < length; i++) {
            o = drones[i];
            if (o.id === drone.id) {
                drones.splice(i, 1);
                debug('leaving drone from load balancing');
                debug(o);
                break;
            }
        }
        return allowed;
    };

    var init = function (domains) {
        var id, dom;
        allowed = {};
        for (id in domains) {
            if (domains.hasOwnProperty(id)) {
                dom = domains[id];
                dom.drones.forEach(function (drone) {
                    drone.domain = dom.name;
                    join(drone);
                });
            }
        }
        return allowed;
    };

    var prxy = function (req, res, next) {
        debug('bypassing proxying');
        next();
    };
    var initialized = false;
    var pending = [];

    var proxup = function (data) {
        debug('proxup:' + data.event);
        debug(data);
        switch (data.event) {
            case 'drone init':
                prxy = proxy(init(data.domains));
                break;
            case 'drone joined':
                prxy = proxy(join(data.drone));
                break;
            case 'drone left':
                prxy = proxy(left(data.drone));
                break;
        }
    };

    process.on('message', function (data) {
        debug('-------------------------------------------------------' + data.event);
        debug('message:' + data.event);
        debug(data);
        switch (data.event) {
            case 'drone joined':
            case 'drone left':
                return initialized ? proxup(data) : pending.push(data);
            case 'self domain':
                self = data.domain;
                self = self.indexOf('*.') === 0 ? self.substring(2) : self;
                debug('self domain:' + self);
                break;
            case 'drone init':
                //process init request
                pending.push(data);
                pending.sort(function (a, b) {
                    return b.at - a.at;
                });
                pending.forEach(function (data) {
                    proxup(data);
                });
                pending = [];
                initialized = true;
                break;
            default :
                break;
        }
    });

    return function (req, res, next) {
        prxy ? prxy(req, res, next) : next();
    };
};

module.exports.config = function (name, fn) {
    var id = uuid.v4();
    process.send({
        id: id,
        event: 'drone config',
        name: name
    });
    configs[id] = fn;
};

module.exports.error = function (err, req, res, next) {
    debug(err.stack);
    res.status(500).send('internal server error');
};
