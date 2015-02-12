var log = require('logger')('hub-agent');
var cluster = require('cluster');
var procevent = require('procevent');
var events = require('events');
var util = require('util');
var uuid = require('node-uuid');
var https = require('https');
var socproc = require('socproc-client');
var agent = require('./lib/agent');

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
    args = Array.prototype.slice.call(args);
    for (id in drones) {
        if (drones.hasOwnProperty(id)) {
            drone = drones[id];
            drone.procevent.emit.apply(drone.procevent, [event].concat(args));
        }
    }
};

module.exports = function (domain, run, done, forks) {

    /*process.on('uncaughtException', function (err) {
     log.fatal('unhandled exception %s', err);
     log.trace(err.stack);
     });*/
    if (typeof done !== 'function') {
        forks = done;
        done = null;
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
        var master = procevent(process);
        master.emit('started', process.pid, address);
        master.destroy();
        agent(function (agent) {
            var id;
            for (id in drones) {
                if (drones.hasOwnProperty(id)) {
                    (function (drone) {
                        drone.procevent.emit('ready');
                        drone.procevent.on('emit', function (event, id, pid, p1, p2) {
                            if (log.debug) {
                                log.debug('emit %s %s %s %s', event, id, p1, p2);
                            }
                            //hub.emit.apply(hub, ['emit'].concat(Array.prototype.slice.call(arguments)));
                            agent.emiton(event, p1, p2, function (err, q1, q2) {
                                log.debug('emiton callback %s, %s, %s, %s, %s', event, id, err, q1, q2);
                                drone.procevent.emit('emitted', id, pid, Array.prototype.slice.call(arguments, 1));
                            });
                        });
                    }(drones[id]));
                }
            }
            agent.on('join', function () {
                broadcast('join', drones, arguments);
            });
            agent.on('leave', function () {
                broadcast('leave', drones, arguments);
            });
        });
    });
};