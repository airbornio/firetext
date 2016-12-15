function initPrintView(document, messageProxy){
	messageProxy.registerMessageHandler(function(e) { printView(e.data.printView); }, "printView");
}

var pages;
function printView(printView) {
	var html = document.getElementsByTagName('html')[0];
	if(printView) {
		document.documentElement.setAttribute('_firetext_print_view', '');
		document.addEventListener('input', printViewOnInput);
		document.defaultView.addEventListener('resize', printViewOnResize);
		document.addEventListener('wheel', printViewOnWheel);
		document.head.appendChild(documentSizeStyle);
		document.head.appendChild(windowSizeStyle);
		printViewOnInput({});
		printViewOnResize();
		document.documentElement.spellcheck = false;
		if(navigator.userAgent.match(/Chrome/)) {
			// Remove squiggly spell check lines.
			// Doesn't work in Safari, but then again adding them back
			// doesn't work either so maybe it's better this way.
			document.body.innerHTML = document.body.innerHTML;
		}
	} else {
		document.documentElement.removeAttribute('_firetext_print_view');
		document.removeEventListener('input', printViewOnInput);
		document.defaultView.removeEventListener('resize', printViewOnResize);
		document.removeEventListener('wheel', printViewOnWheel);
		if(documentSizeStyle.parentElement) documentSizeStyle.parentElement.removeChild(documentSizeStyle);
		if(windowSizeStyle.parentElement) windowSizeStyle.parentElement.removeChild(windowSizeStyle);
		pages = null;
		if(wordCountEnabled) {
			updateWordCountElement();
		}
		document.documentElement.spellcheck = true;
		if(navigator.userAgent.match(/Chrome/)) {
			// Add squiggly spell check lines.
			// 
			// Chrome spell checks a paragraph when you click in it.
			// So the basic idea here is to visit every paragraph (every
			// block-level element, in fact), select it, and wait a bit
			// to give Chrome a chance to spell check it. It doesn't
			// seem to work too well in table cells (only the bottom-
			// right-most cell gets spell checked).
			// 
			// Chrome also spell checks on paste, but execCommand('paste')
			// is disabled, so that's not very useful to us.
			var sel = document.getSelection();
			var range = sel.rangeCount && sel.getRangeAt(0);
			sel.removeAllRanges();
			var elms = document.querySelectorAll(blockElementNames.replace('html,', ''));
			var i = 0;
			(function next(i) {
				if(sel.rangeCount) {
					// User clicked somewhere, stop selecting stuff.
					return;
				}
				var r = document.createRange();
				r.selectNode(elms[i]);
				sel.addRange(r);
				sel.removeAllRanges();
				setTimeout(function() {
					if(i + 1 === elms.length) {
						if(range) sel.addRange(range);
					} else {
						next(i + 1);
					}
				});
			})(0);
		}
	}
}

var documentSizeStyle = document.createElement('style');
documentSizeStyle.setAttribute('_firetext_remove', '');
function printViewOnInput(evt) {
	documentSizeStyle.textContent = '';
	pages = Math.ceil(document.body.offsetHeight / (document.documentElement.offsetHeight - 30));
	documentSizeStyle.textContent = [
		'html {',
		'	padding-right: calc(' + (pages - 1) + ' * (var(--width) - 2 * var(--margin) + 40px) + 40px);',
		'}',
		'body {',
		'	height: ' + pages + '00%;',
		'}',
	].join('\n');
	if(evt.detail) { // fromCollab or fromProperties might change page size
		printViewOnResize();
	}
	if(wordCountEnabled) {
		updateWordCountElement();
	}
}

var windowSizeStyle = document.createElement('style');
windowSizeStyle.setAttribute('_firetext_remove', '');
var scale;
function printViewOnResize() {
	scale = window.innerHeight / (document.documentElement.offsetHeight + 30);
	windowSizeStyle.textContent = [
		'html {',
		'	transform: scale(' + scale + ');',
		'}',
	].join('\n');
}

function printViewOnWheel(evt) {
	if(evt.deltaX) {
		return;
	}
	var px;
	switch(evt.deltaMode) {
		case WheelEvent.DOM_DELTA_PIXEL: px = evt.deltaY; break;
		case WheelEvent.DOM_DELTA_LINE: px = evt.deltaY * 30; break;
		case WheelEvent.DOM_DELTA_PAGE: px = evt.deltaY * scale * document.body.clientWidth; break;
	}
	document.defaultView.scrollBy(px, 0);
	evt.preventDefault();
}