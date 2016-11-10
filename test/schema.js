var applicationRoot = __dirname.replace(/\\/g, '/').replace('/test', ''),
	ipaddress = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1',
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

/* Read the directory tree according to the pattern specified above. */
var files = glob.sync(mockRootPattern);

if (files && files.length > 0) {
	var tv4 = require('tv4');
	var errors = false;
	files.forEach(function (file) {
		var fileContent = fs.readFileSync(file, 'utf8');
		var json = JSON.parse(fileContent);
		['request', 'response'].forEach(function (variation) {
			if (json[variation].schema) {
				tv4.addSchema('../definitions.json', require(schemaRoot + 'definitions.json'));
				tv4.addSchema('definitions.json', require(schemaRoot + variation + 's/definitions.json'));
				var variationSchema = require(schemaRoot + json[variation].schema);
				var variationJson = json[variation];
				var variationJsonBody = variationJson.body;

				if (!tv4.validate(variationJsonBody, variationSchema)) {
					console.log('Failed validation for %s %s: ', variation, file);
					console.trace(tv4.error);
					console.log('\n');
					errors = true;
				}

				if (variationJson.headers['Content-Length'] && variationJson.headers['Content-Length'] != JSON.stringify(variationJson.body).length) {
					console.log('Wrong Content-Length for %s %s: ', variation, file);
					console.log('Content-Length: %d actual: %d', variationJson.headers['Content-Length'], JSON.stringify(variationJson.body).length);
					errors = true;
				}
				tv4.reset();
			}
		});
	});
	if (errors) {
		process.exit(1);
	}
}

