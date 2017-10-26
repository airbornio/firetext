window.addEventListener('DOMContentLoaded', function() {
	// Proxy for communication with parent page
	var parentMessageProxy = new MessageProxy();
	parentMessageProxy.setSend(parent);
	parentMessageProxy.setRecv(window);
	
	parentMessageProxy.registerMessageHandler(function(evt) {
		document.open('text/html', 'replace');
		document.write(evt.data.content);
		document.close();
		parentMessageProxy.setRecv(window);
		window.print();
	}, 'print');
});