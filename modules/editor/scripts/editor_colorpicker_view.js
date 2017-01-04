function initColorPickerView(document, messageProxy) {
	messageProxy.registerMessageHandler(function(e) { colorPickerView(e.data.enabled); }, "colorPickerView");
}

function colorPickerView(enabled) {
	if(enabled) {
		document.documentElement.setAttribute('_firetext_colorpicker_view', '');
	} else {
		document.documentElement.removeAttribute('_firetext_colorpicker_view');
	}
	var sel = document.getSelection();
	if(sel.rangeCount) {
		var range = sel.getRangeAt(0);
		sel.removeAllRanges();
		if(enabled) {
			setTimeout(function() {
				sel.addRange(range);
			});
		} else {
			sel.addRange(range);
		}
	}
}