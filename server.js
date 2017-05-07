/*
 * gopher server
 *
 */

var net = require('net');
var fs = require('fs');
var bunyan = require('bunyan');

if (process.argv[2] === undefined || process.argv[2] === "") {
    console.error('Please provide a directory (relative or absolute) that' +
            ' includes a valid index.json file.');
    process.exit(1);
}

var log = bunyan.createLogger({name: 'gopher'});
var fileDir = process.argv[2]; // Directory where files are stored.
var index;

// We'll keep the main landing listing in memory
// because we don't want to hit disk every time someone
// navigates to our Gopher hole.
fs.readFile(fileDir + "/index.json", function (err, data) {
    if (err) {
        log.error('Error reading index file: ', err, '. Did you give us' +
            ' a directory with an index.json file?');
    }

    index = JSON.parse(data)['entries']; // Parse the top-level file index
});

net.createServer(function (socket) {
    log.info('connection: ', socket.address());

    socket.on('end', function () {
        socket.end();
    });

    socket.on('close', function(err) {
        socket.end();
    });

    socket.on('data', function(data) {
        var request = data.toString();
        if (request === '\r\n') {
            // The user has requested a top-level listing.
            var buf = "";
            index.forEach(function (item) {
                buf += item.type + '\t';
                buf += item.display + '\t';
                buf += (item.selector || "") + '\t';
                buf += item.server + '\t';
                buf += item.port;
                buf += '\n';
            });
            buf += '\n.';
            socket.end(buf);
            return;
        }

        request = request.trim();
        var found = false;
        index.forEach(function (item) {
            if (request === item.display) {
                // The user has requested this specific item.
                found = true;
                if (item.type === 0) {
                    // A file type - we can just send it along the wire.
                    fs.readFile(fileDir + '/' + item.selector,
                        function (err, data) {
                            if (err) {
                                log.err('Error reading selected file: ', err);
                                socket.end('\n.');
                                return;
                            }
                            socket.end(data.toString() + '\n.');
                        }
                    );
                    return;
                } else {
                    // Unimplemented - all other types.
                    socket.end('\n.');
                    return;
                }
            }
        });
        if (found === false) {
            // What should we do when the item they request isn't found?
            socket.end('\n.');
        }
        return;
    });

}).listen(70, '127.0.0.1');
log.info('server started');
