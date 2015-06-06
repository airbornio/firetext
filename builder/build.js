/*** SET UP AIRBORN OS ***/

var fs = require('fs');

var window = global.window = global;
global.parent = global;

window.sjcl = require('sjcl');

function randomWords(n) {
	return Array.apply(null, new Array(n)).map(function() { return Math.floor(Math.random() * 0xFFFFFFFF); });
}
var hmac_bits = randomWords(4);
var files_hmac = window.files_hmac = new sjcl.misc.hmac(hmac_bits);

window.XMLHttpRequest = function() {
	this.listeners = {};
};
window.XMLHttpRequest.prototype.addEventListener = function(name, listener) {
	if(!this.listeners[name]) {
		this.listeners[name] = [];
	}
	this.listeners[name].push(listener);
};
window.XMLHttpRequest.prototype.emit = function(name) {
	if(this.listeners[name]) {
		var _this = this;
		this.listeners[name].forEach(function(listener) {
			listener.call(_this);
		});
	}
};
window.XMLHttpRequest.prototype.open = function(method, url) {
	if(url.substr(0, 8) === '/object/' && method === 'GET') {
		var hash = url.split('#')[1]
		var codec = hash.substr(0, hash.indexOf('.'));
		url = hash.substr(hash.indexOf('.') + 1).replace('/Core/', 'airbornos/');
		Object.defineProperty(this, 'send', {value: function() {
			var _this = this;
			fs.readFile(url, codec ? 'base64' : 'utf8', function(err, contents) {
				Object.defineProperty(_this, 'readyState', {get: function() { return 4; }});
				if(err) {
					Object.defineProperty(_this, 'status', {get: function() {
						return 404;
					}});
				} else {
					Object.defineProperty(_this, 'status', {get: function() {
						return 200;
					}, configurable: true});
					Object.defineProperty(_this, 'responseText', {get: function() {
						if(codec) return sjcl.codec.utf8String.fromBits(sjcl.codec.base64.toBits(contents));
						return contents;
					}});
				}
				_this.emit('readystatechange');
				_this.emit('load');
			});
		}});
		return;
	} else if(url.substr(0, 8) === '/object/' || url.substr(0, 13) === '/transaction/') {
		Object.defineProperty(this, 'setRequestHeader', {value: function() {}});
		Object.defineProperty(this, 'send', {value: function() {
			Object.defineProperty(this, 'readyState', {get: function() { return 4; }});
			Object.defineProperty(this, 'status', {get: function() {
				return 200;
			}});
			this.emit('readystatechange');
			this.emit('load');
		}});
		return;
	}
	throw new Error('Unknown XMLHttpRequest url: ' + url);
};
sjcl.encrypt = sjcl.decrypt = function(key, content) {
	return content;
};

window.document = {};
document.createElement = function() {
	return {};
};
document.head = {};
document.head.appendChild = function() {};

window.crypto = {};
window.crypto.getRandomValues = function(array) {
	var words = randomWords(array.length);
	words.forEach(function(word, i) {
		array[i] = word;
	});
	console.log(words, array);
};

// Make Airborn OS use Data URLs
window.navigator = {};
window.navigator.userAgent = 'Chrome';
window.location = {};
window.location.protocol = 'https:';

window.eval(fs.readFileSync('airbornos/core.js', 'utf8'));

/*** END SET UP AIRBORN OS ***/


// Compile everything into a single html file
prepareFile(process.argv[2], {compat: false, _compat: false, bootstrap: false, rootParent: '../'}, function(contents) {
	
	
	// Extract scripts
	var scripts = [];
	contents = contents.replace(/<script([^>]*)src="([^"]*)"([^>]*)><\/script>/g, function(match, preAttrs, url, postAttrs) {
		scripts.push(decodeURIComponent(url.split(',')[0].match(/filename=([^;]*);/)[1]));
		return '';
	});
	
	
	// Minify scripts
	var cc = require('child_process').spawn('java', [
		'-jar', 'node_modules/google-closure-compiler/compiler.jar',
		'--language_in', 'ECMASCRIPT5',
		'--js_output_file', process.argv[2].replace('../', '../build/').replace(/[^\/]*\.html/, 'scripts.js'),
		'--create_source_map', '%outname%.map'
	].concat(scripts));
	cc.stderr.on('data', function(data) {
		console.error('' + data);
	});
	cc.on('close', function() {
		contents = contents.replace(/(?=<\/head)/i, '<script src="scripts.js"></script>');
		
		
		// Extract styles
		var styles = [];
		contents = contents.replace(/<link([^>]*)href="([^"]*)"([^>]*)>/g, function(match, preAttrs, url, postAttrs) {
			var attrs = preAttrs + postAttrs;
			if(attrs.indexOf(' rel="stylesheet"') !== -1) {
				var style = decodeURIComponent(url.split(',')[1]);
				var media = attrs.match(/media="([^"]*)"/);
				if(media) style = '@media ' + media[1] + '{' + style + '}';
				styles.push(style);
				return '';
			}
			return match;
		});
		
		
		// Remove unused css
		require('uncss')(contents, {
			raw: styles.join('\n'),
			ignore: [
				/\[disabled\]/,
				/\.current/,
				/\.parent/,
				/\.active/,
				/\.selected-tab/,
				/\.shown/,
				/section\[role="status"\]/,
				/\.hidden-item/,
				'.mainButtons button b',
				/\.fileListItem/,
				'[data-type="list"] li > a',
				/\.CodeMirror/,
				/\.cm-/,
				/\[dir="rtl"\]/,
				/\.fullscreen/,
				/\.icon-efs/,
				/\.night/,
			]
		}, function(err, css) {
			
			// Minify css
			css = require('more-css').compress(css);
			fs.writeFileSync(process.argv[2].replace('../', '../build/').replace(/[^\/]*\.html/, 'styles.css'), css);
			contents = contents.replace(/(?=<\/head)/i, '<link rel="stylesheet" href="styles.css">');
			
			
			// Minify html
			contents = require('html-minifier').minify(contents, {
				removeComments: true,
				removeCommentsFromCDATA: true,
				collapseWhitespace: true,
				collapseBooleanAttributes: true,
				removeAttributeQuotes: true,
				removeScriptTypeAttributes: true,
				removeStyleLinkTypeAttributes: true,
				minifyJS: true,
				minifyCSS: true,
			});
			
			
			// Write to build folder
			fs.writeFileSync(process.argv[2].replace('../', '../build/'), contents);
			
		});
	});
	
});