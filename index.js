var proxy = require('proxy');
var uuid = require('node-uuid');

var configs = {};

module.exports = function (server, port) {
    var serve = function () {
        var address = server.address();
        console.log('listening on ' + JSON.stringify(address));
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
            console.log('event:drone configed id:' + data.id);
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
            console.log('load balancing drone : ' + domain);
            domain = domain.substring(2);
            console.log('domain : ' + domain + ' self : ' + self);
            if (self === domain) {
                console.log('self domain, skipping proxying');
                return allowed;
            }
        } else if (self !== domain) {
            console.log('non-self non load balancing drone, skipping proxying');
            return allowed;
        }
        var o = allowed[domain] || (allowed[domain] = []);
        var drn = {
            id: drone.id,
            ip: drone.ip,
            port: drone.port
        };
        o.push(drn);
        console.log('adding drone for load balancing');
        console.log(drn);
        return allowed;
    };

    var left = function (drone) {
        var domain = drone.domain;
        if (domain.indexOf('*.') === 0) {
            console.log('load balancing drone : ' + domain);
            domain = domain.substring(2);
            console.log('domain : ' + domain + ' self : ' + self);
            if (self === domain) {
                console.log('self domain, skipping proxying');
                return allowed;
            }
        } else if (self !== domain) {
            console.log('non-self non load balancing drone, skipping proxying');
            return allowed;
        }
        var i, o;
        var drones = allowed[domain] || (allowed[domain] = []);
        var length = drones.length;
        for (i = 0; i < length; i++) {
            o = drones[i];
            if (o.id === drone.id) {
                drones.splice(i, 1);
                console.log('leaving drone from load balancing');
                console.log(o);
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
        console.log('proxup:' + data.event);
        console.log(data);
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
        console.log('message:' + data.event);
        console.log(data);
        switch (data.event) {
            case 'drone joined':
            case 'drone left':
                return initialized ? proxup(data) : pending.push(data);
            case 'self domain':
                self = data.domain;
                self = self.indexOf('*.') === 0 ? self.substring(2) : self;
                console.log('self domain:' + self);
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
    console.log(err.stack);
    res.status(500).send('internal server error');
};
