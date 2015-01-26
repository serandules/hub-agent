var log = require('logger')('hub-agent');
var cluster = require('cluster');
var procevent = require('procevent');

var cpus = require('os').cpus().length;

module.exports = function (domain, run, workers) {
    if (cluster.isWorker) {
        return run();
    }
    workers = workers || cpus;
    var i;
    var worker;
    if (log.debug) {
        log.debug('forking workers');
    }
    for (i = 0; i < workers; i++) {
        worker = cluster.fork();
    }
    cluster.on('exit', function (worker, code, signal) {
        if (log.debug) {
            log.debug('%s worker %s stopped (%s)', domain, worker.process.pid, signal || code);
            log.debug('%s worker restarting', domain);
        }
        cluster.fork();
    });
    cluster.on('listening', function (worker, address) {
        if (log.debug) {
            log.debug('worker started');
        }
        if (--workers > 0) {
            return;
        }
        if (log.debug) {
            log.debug('all workers started');
        }
        var drone = procevent(process);
        drone.emit('started', process.pid, address);
    });
    process.on('uncaughtException', function (err) {
        log.error('unhandled exception %s', err);
        if (log.debug) {
            log.trace(err.stack);
        }
    });
};