var debug = require('debug')('serandules:hub-agent');
var proxy = require('proxy');
var uuid = require('node-uuid');

var configs = {};

module.exports = function (server, port) {
    var serve = function () {
        var address = server.address();
        debug('listening on ' + JSON.stringify(address));
        if (!process.send) {
            return;
        }
        process.send({
            event: 'drone started',
            address: address,
            pid: process.pid
        });
        process.on('message', function (data) {
            if (data.event !== 'drone configed') {
                return;
            }
            debug('event:drone configed id:' + data.id);
            var fn = configs[data.id];
            fn(data.value);
            delete configs[data.id];
        });
    };
    port ? server.listen(port, serve) : server.listen(serve);
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

    var prxy;
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
