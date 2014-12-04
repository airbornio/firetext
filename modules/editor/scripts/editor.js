/*
* Editor Communication Proxy
* Copyright (C) Codexa Organization 2013.
*/

'use strict'

// Closure to isolate code from tampering by scripts in document
var mainClosure = function() {
	// document to be edited
	var doc;
	
	// WARNING: DO NOT REPLACE, THIS STRING IS REPLACED WITH THE ORIGIN AUTOMATICALLY WHEN LOADED FROM editorProxy.js
	var mainOrigin = "[ORIGIN_OF_MAIN_DOCUMENT]";
	
	// Overide popups
	window.alert = null;
	window.confirm = null;
	window.prompt = null;
	
	// Proxy for communication with parent page
	var parentMessageProxy;

	
				
	//document.open();

	window.addEventListener("message", function(e){
		if(e.origin !== mainOrigin) {
			throw new Error("origin did not match");
		}
		if(e.data.command === "init" && e.ports.length) {
			var tunnel = document.getElementById('tunnel');

			// Initialize Designer
			var style = document.getElementsByTagName('style')[0];
			
			// register port
			parentMessageProxy = new MessageProxy(e.ports[0]);
			
			// initialize modules/register handlers
			// night mode
			initNight(doc, parentMessageProxy);
			
			// editor I/O
			
			var scripts_for_content = document.querySelectorAll('script[data-for-content]');
			
			var content_script = document.getElementById('content_script');
			
			initDocIO(document, parentMessageProxy, function beforeWrite() {
				//window.postMessage({command: 'connect'}, '*', [parentMessageProxy.getPort()]);
				/*var tunnel = new Worker(URL.createObjectURL(new Blob([
					'addEventListener("message", function(e) { console.log(this, arguments); postMessage(e.data, e.ports) });'
				], {type: 'text/javascript'})))
				parent.postMessage({command: 'connect'}, '*', [parentMessageProxy.getPort()]);*/
				//message_channel = document.getElementById('message_channel')
				
				parentMessageProxy.getPort().postMessage({command: "new-port-please"});
			}, function afterWrite() {
				/*var tunnel = new Worker(URL.createObjectURL(new Blob([
					'addEventListener("message", function(e) { console.log(this, arguments); postMessage(e.data, e.ports) });'
				], {type: 'text/javascript'})))*/
				//tunnel.postMessage({command: 'connect'}, [parentMessageProxy.getPort()]);
				
				//parent.postMessage({command: 'newport'}, '*');
				//parentMessageProxy.getPort().postMessage({command: "new-port-please"});
				
				console.log('equal windows:', window === document.defaultView);
				
				var win = document.defaultView;
				
				[].forEach.call(scripts_for_content, function(script) {
					win.eval(atob(script.src.split(',')[1]));
				});
				
				
				
				window.mainOrigin = mainOrigin;
				window.parentMessageProxy = parentMessageProxy;
				window.initNight = initNight;
				
				// Content styles
				style.setAttribute('_firetext_remove', '');
				document.head.appendChild(document.adoptNode(style));
				
				// Content script
				var script = document.createElement('script');
				script.setAttribute('_firetext_remove', '');
				script.textContent = content_script.textContent;
				document.head.appendChild(script);
				
				delete window.mainOrigin;
				delete window.parentMessageProxy;
				delete window.initNight;
			});
			
			parentMessageProxy.getPort().start();
			// success
			parentMessageProxy.getPort().postMessage({command: "init-success"});
		}
	}, false);
}
mainClosure();
mainClosure = undefined;
