var log = require('logger')('hub-agent:cluster');
var cluster = require('cluster');
var procevent = require('procevent');

var cpus = require('os').cpus().length;

//TODO: fix debug port conflict
var debug = false;

var fork = function (drones) {
    if (debug) {
        cluster.settings.execArgv.push('--debug=' + (5859));
    }
    var worker = cluster.fork();
    if (debug) {
        cluster.settings.execArgv.pop();
    }
    drones[worker.process.pid] = {
        worker: worker,
        procevent: procevent(worker.process) //TODO
    };
};

var broadcast = function (event, drones, args) {
    var drone;
    var id;
    args = Array.prototype.slice.call(args || []);
    for (id in drones) {
        if (drones.hasOwnProperty(id)) {
            drone = drones[id];
            drone.procevent.emit.apply(drone.procevent, [event].concat(args));
        }
    }
};

module.exports = function (domain, run, forks, done) {

    /*process.on('uncaughtException', function (err) {
     log.fatal('unhandled exception %s', err);
     log.trace(err.stack);
     });*/
    if (typeof forks === 'function') {
        done = forks;
        forks = null;
    }
    var drone;
    if (cluster.isWorker) {
        drone = procevent(process); //TODO
        drone.once('ready', function () {
            log.info('ready event fired');
            if (!done) {
                return;
            }
            done(false, drone);
        });
        return run();
    }
    forks = forks || cpus;
    var drones = {};
    if (log.debug) {
        log.debug('forking workers');
    }
    cluster.setupMaster({
        execArgv: process.execArgv.filter(function (s) {
            return s !== '--debug'
        })
    });
    var i;
    for (i = 0; i < forks; i++) {
        fork(drones);
    }
    cluster.on('exit', function (worker, code, signal) {
        if (log.debug) {
            log.debug('%s worker %s stopped (%s)', domain, worker.process.pid, signal || code);
            log.debug('%s worker restarting', domain);
        }
        delete drones[worker.process.pid];
        //fork(drones);
    });
    cluster.on('listening', function (worker, address) {
        if (log.debug) {
            log.debug('worker started');
        }
        if (--forks > 0) {
            return;
        }
        if (log.debug) {
            log.debug('all workers started');
        }
        broadcast('ready', drones);
    });
};
