/* Define some initial variables. */
var applicationRoot = __dirname.replace(/\\/g, '/'),
	ipaddress = process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0',
	port = process.env.OPENSHIFT_NODEJS_PORT || 3001;
mockRoot = applicationRoot + '/mocks',
mockFilePattern = '.json',
mockRootPattern = mockRoot + '/**/*' + mockFilePattern,
schemaRoot = applicationRoot + '/platform-data-contracts/schemas/web/',

apiRoot = '',
fs = require('fs'),
glob = require('glob');

/* Create Express application */
var express = require('express');
var app = express();

/* Configure a simple logger and an error handler. */
var morgan = require('morgan');
app.use(morgan('dev'));
var errorHandler = require('errorhandler');
app.use(errorHandler({ dumpExceptions: true, showStack: true }));
var bodyParser = require('body-parser');
app.use(bodyParser.json());

/* Read the directory tree according to the pattern specified above. */
var files = glob.sync(mockRootPattern);

if (files && files.length > 0) {
	var directories = files.map(function (object) {
		return object.substring(0, object.lastIndexOf('\/'));
	});
	directories = directories.filter(function (value, index, self) {
		return self.indexOf(value) === index;
	});
	/* Register mappings for each leaf directory found in the directory tree. */
	if (directories && directories.length > 0) {
		console.log('Registered mapping: ');
		directories.forEach(function (path) {
			var mapping = apiRoot + path.replace(mockRoot, '').replace(mockFilePattern, '');
			app.all(mapping, function (req, res) {
				var jsonFiles = glob.sync(path + '/*' + mockFilePattern);
				var found = false;
				jsonFiles.some(function (fileName) {
					var data = fs.readFileSync(fileName, 'utf8');
					var json = JSON.parse(data);
					if (json.request.method == req.method
						&& json.request.headers['Accept-Language'] == req.header('Accept-Language')
						&& json.request.headers['Mock'] == req.header('Mock')
						&& ((json.request.parameters == null && Object.keys(req.query).length == 0)
						|| Object.keys(req.query).length == Object.keys(json.request.parameters).length
						)
					) {
						for (var key in req.query) {
							if (req.query.hasOwnProperty(key)) {
								if (req.query[key] === "true") {
									req.query[key] = true
								} else if (req.query[key] === "false") {
									req.query[key] = false
								}
								if (json.request.parameters[key] != req.query[key]) {
									return false;
								}
							}
						}

						if (json.request.body == null) {
							json.request.body = {};
						}
						if (!deepCompare(json.request.body, req.body)) {
							return false;
						}

						res.writeHead(json.response.code, json.response.headers);
						if (json.response.body) {
							res.write(JSON.stringify(json.response.body));
						}
						res.end();
						found = true;
					}
					return found;
				});
				if (!found) {
					res.writeHead(404);
					res.end();
				}
			});
			console.log(' %s -> %s', mapping, path);
		});
	}
} else {
	console.log('No mappings found! Please check the configuration.');
}

/* Start the API mock server. */
console.log('Mock Api Server listening: http://' + ipaddress + ':' + port);
app.listen(port, ipaddress);

function deepCompare () {
	var i, l, leftChain, rightChain;

	function compare2Objects (x, y) {
		var p;

		// remember that NaN === NaN returns false
		// and isNaN(undefined) returns true
		if (isNaN(x) && isNaN(y) && typeof x === 'number' && typeof y === 'number') {
			return true;
		}

		// Compare primitives and functions.
		// Check if both arguments link to the same object.
		// Especially useful on the step where we compare prototypes
		if (x === y) {
			return true;
		}

		// Works in case when functions are created in constructor.
		// Comparing dates is a common scenario. Another built-ins?
		// We can even handle functions passed across iframes
		if ((typeof x === 'function' && typeof y === 'function') ||
			(x instanceof Date && y instanceof Date) ||
				(x instanceof RegExp && y instanceof RegExp) ||
				(x instanceof String && y instanceof String) ||
				(x instanceof Number && y instanceof Number)) {
					return x.toString() === y.toString();
				}

		// At last checking prototypes as good as we can
		if (!(x instanceof Object && y instanceof Object)) {
			return false;
		}

		if (x.isPrototypeOf(y) || y.isPrototypeOf(x)) {
			return false;
		}

		if (x.constructor !== y.constructor) {
			return false;
		}

		if (x.prototype !== y.prototype) {
			return false;
		}

		// Check for infinitive linking loops
		if (leftChain.indexOf(x) > -1 || rightChain.indexOf(y) > -1) {
			return false;
		}

		// Quick checking of one object being a subset of another.
		// todo: cache the structure of arguments[0] for performance
		for (p in y) {
			if (y.hasOwnProperty(p) !== x.hasOwnProperty(p)) {
				return false;
			}
			else if (typeof y[p] !== typeof x[p]) {
				return false;
			}
		}

		for (p in x) {
			if (y.hasOwnProperty(p) !== x.hasOwnProperty(p)) {
				return false;
			}
			else if (typeof y[p] !== typeof x[p]) {
				return false;
			}

			switch (typeof (x[p])) {
				case 'object':
				case 'function':

					leftChain.push(x);
					rightChain.push(y);

					if (!compare2Objects (x[p], y[p])) {
						return false;
					}

					leftChain.pop();
					rightChain.pop();
					break;

				default:
					if (x[p] !== y[p]) {
						return false;
					}
					break;
			}
		}

		return true;
	}

	if (arguments.length < 1) {
		return true; //Die silently? Don't know how to handle such case, please help...
		// throw "Need two or more arguments to compare";
	}

	for (i = 1, l = arguments.length; i < l; i++) {

		leftChain = []; //Todo: this can be cached
		rightChain = [];

		if (!compare2Objects(arguments[0], arguments[i])) {
			return false;
		}
	}

	return true;
}
