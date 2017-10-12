var mod_artedi = require('artedi');
var mod_bunyan = require('bunyan');
var mod_dashdash = require('dashdash');
var mod_net = require('net');
var mod_fs = require('fs');

var LOG = mod_bunyan.createLogger({name: 'gopher'});
var FILE = 0;
var DIR = 1;

/*
 * An object to encapsulate the Gopher server.
 */
function Gopher() {
    this.opts = parseArgs();
    this.index = buildIndex(this.opts.root);

    /*
     * Set up metric collection.
     */
    this.collector = mod_artedi.createCollector();
    this.request_counter = this.collector.counter({
        name: 'gopher_request_counter',
        help: 'count of gopher requests recieved'
    });
}

/*
 * Wait for requests, and then act on them.
 */
Gopher.prototype.serve = function serve() {
    var request, entry, self;   /* Objects */
    self = this;
    mod_net.createServer(function (socket) {
        LOG.info(socket, 'connection received');

        function done(args) {
            self.request_counter.increment({
                labels: {
                    'request': args.request
                }
            });

            socket.end(args.data);
        }
        socket.on('end', function () {
            socket.end();
        });
        socket.on('close', function (err) {
            if (err) {
                LOG.error('gopher: error:', err.message);
            }
            socket.end();
        });

        /*
         * When we get a request we either want to display the root directory,
         * or find what the user is looking for.
         */
        socket.on('data', function (data) {
            request = data.toString();
            if (request === '\r\n') {
                /* Display the root index. */
                done({
                    'data': listDir(self.index),
                    'request': 'getroot'
                });
                return;
            }

            /* Get the entry the user requested */
            request = request.trim();

            if (request === 'metrics') {
                self.collector.collect(mod_artedi.FMT_PROM,
                    function (err, metrics) {
                        if (err) {
                            LOG.warn(err, 'error collecting metrics');
                            return;
                        }
                        setImmediate(done({
                            'data': metrics,
                            'request': request
                        }));
                });
                return;
            }

            entry = getEntry(request, self.index);
            if (entry.type === DIR) {
                done({
                    'data': listDir(entry.listing),
                    'request': request
                });
            } else if (entry !== null) {
                done({
                    'data': entry.content + '\n.',
                    'request': request
                });
            } else {
                LOG.info('User requested unknown entry: %s', request);
                done({
                    'data': '\n.',
                    'request': 'unknown'
                });
            }

            return;
        });
    }).listen(70, '0.0.0.0'); /* Listen on all interfaces. */
};

/*
 * Return the data for the requested entry. This is a recursive function.
 * 1) Search the current directory for the requested entry.
 *  1a) If found, return requested entry.
 *  1b) If not found, go to 1) beginning at a subdirectory.
 *
 * This is currently a depth-first serial search because it's easy and I'm not
 * anticipating a very high number of graph levels due to the nature of this
 * project.
 *
 */
function getEntry(name, index) {
    var toRet = null;   /* Return object */
    var subdirs = [];   /* Subdirs to search if entry not found */
    index.entries.forEach(function (entry) {
        if (toRet !== null) {
            return;
        }
        if (entry.selector === name) {
            toRet = entry;
        } else if (entry.type === DIR) {
            subdirs.push(entry);
        }
    });
    if (toRet === null) {
        subdirs.forEach(function (subdir) {
            if (toRet !== null) {
                return;
            }
            toRet = getEntry(name, subdir.listing);
        });
    }
    return (toRet);
}

/*
 * Return information about the entries in a directory.
 */
function listDir(subindex) {
    var buf = '';

    subindex.entries.forEach(function (entry) {
        buf += [entry.type,
                entry.display,
                entry.selector,
                entry.server,
                entry.port,
                '\n'].join('\t');
    });
    buf += '\n.';
    return (buf);
}

/*
 * Populate an index of content in memory. This is a multi-step recursive
 * process:
 * 1) Read entries from the directory's index.json file.
 *   1a) If the entry is a subdir, recurse, go to 1).
 *   1b) If the entry is a post, read it into memory.
 */
function buildIndex(dir) {
    var index; /* Object */
    index = JSON.parse(mod_fs.readFileSync(dir + '/index.json', 'utf8'));

    index.entries.forEach(function processEntry(entry) {
        if (entry.type === DIR) {
            entry.listing = buildIndex(dir + '/' + entry.selector);
        } else if (entry.type === FILE) {
            entry.content =
                mod_fs.readFileSync(dir + '/' + entry.selector, 'utf8');
        } else {
            throw new Error('Unknown entry type: ' + entry.type);
        }
    });

    return (index);
}

/*
 * Set up argument parsing.
 */
function parseArgs() {
    var options, opts;
    var parser;
    options = [
        {
            names: ['help', 'h'],
            type: 'bool',
            help: 'Print this help and exit'
        },
        {
            names: ['root', 'r'],
            type: 'string',
            help: 'Path to Gopher root'
        }
    ];

    parser = mod_dashdash.createParser({options: options});
    try {
        opts = parser.parse(process.argv);
    } catch (e) {
        LOG.error('gopher: error: %s', e.message);
        process.exit(1);
    }

    if (opts.help) {
        var help = parser.help({includeEnv: true}).trimRight();
        console.log('usage: node gopher.js [OPTIONS]\n'
                + 'options:\n'
                + help);
        process.exit(0);
    }
    return (opts);
}

/*
 * Main routine.
 */
var gopher = new Gopher();
gopher.serve();
