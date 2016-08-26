/*
* Modules
* Copyright (C) Codexa Organization.
*/

if (!app) {
	var app = {};
}

(function(window, undefined) {
	'use strict';
	
	function loadModule(url, callback) {
		// Validate params
		if (!url) {
			callback('bad-params');
		}
	
		// Get module
		var request = new XMLHttpRequest();
		request.open("GET", url, true);
		request.responseType = "document";
		request.overrideMimeType("text/html");
		request.addEventListener("load", function(e) {
			if(this.status === 200) {
				var response = this.response;
				var elements = response.querySelectorAll("script, link");
				var loading = {};
				for (var i = 0; i < elements.length; i++) {
					(function() {
						var element = elements[i];
						var name = element.tagName;
						if(name === "SCRIPT" ? element.src : element.href) {
							var type = element.type;
							var url = name === "SCRIPT" ? element.src : element.href;
							var data = element.dataset;
							if(!loading[url]) {
								loading[url] = [];
								var req = new XMLHttpRequest();
								req.open("GET", url, true);
								req.responseType = "text";
								req.addEventListener("load", function(e) {
									var done = true;
									if(this.status === 200) {
										var inline = response.createElement(name === "SCRIPT" ? "SCRIPT" : "STYLE");
										var text = this.response;
										text = text.replace(/\[ORIGIN_OF_MAIN_DOCUMENT\]/g, window.location.origin ? window.location.origin : window.location.protocol + "//" + window.location.host);
										inline.type = type;
										if(name === "SCRIPT") {
											inline.textContent = text.replace(/<\/(script)/ig, '<\\\/$1') +
												'\n//# sourceURL=' + url;
										} else {
											inline.textContent = text.replace(/</g, '%3C').replace(/>/g, '%3E') + // Hack to not trip up getHTML() regex and keep editor.css cleaner.
												'\n/*# sourceURL=' + url + '*/';
										}
										for (var key in data) {
											inline.dataset[key] = data[key];
										}
										loading[url][0].parentNode.replaceChild(inline, loading[url][0]);
										for (var i = 1; i < loading[url].length; i++) {
											loading[url][i].parentNode.removeChild(loading[url][i]);
										}
										delete loading[url];
										for(var x in loading) {
											done = false;
											break;
										}
										if (done) {
											callback(null, 'data:text/html,' + encodeURIComponent(response.documentElement.outerHTML));
										}
									}
								}, false);
								req.send();
							}
							loading[url].push(element);
						}
					})();
				}
			} else {
				callback(this.status);
			}
		}, false);
		request.send();
	}
	
	var cache = {};
	
	app.modules = {
		load: function (url, frame, callback) {
			console.log('Loading '+url);
			
			if(cache[url]) {
				frame.src = cache[url];
				callback();
				return;
			}
			
			loadModule(url, function(err, result) {
				if (err) {
					console.error(err);
				} else {
					cache[url] = result;
					frame.src = result;
					callback();
				}
			});
		}
	};
})(this);
