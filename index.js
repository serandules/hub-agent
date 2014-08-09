module.exports = function (server) {
    server.listen(function () {
        var address = server.address();
        console.log('listening on ' + JSON.stringify(address));
        if (!process.send) {
            return;
        }
        process.send({
            event: 'started',
            address: address,
            pid: process.pid
        });
    });
};