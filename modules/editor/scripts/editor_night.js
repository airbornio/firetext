function initNight(document, messageProxy){
	function nightEditor(nightMode) {
		if(nightMode) {
			document.documentElement.style.color = '#fff';
		} else {
			document.documentElement.style.color = '#000';
		}
	}
	messageProxy.registerMessageHandler(function(e) { nightEditor(e.data.nightMode); }, "night");
}