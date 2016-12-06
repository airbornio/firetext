var messageProxy, wordCountEnabled;
function initWordCount(document, _messageProxy){
	messageProxy = _messageProxy;
	messageProxy.registerMessageHandler(function(e) { wordCount(e.data.wordCount); }, "wordCount");
}

function wordCount(wordCount) {
	if(wordCountEnabled = wordCount) {
		document.addEventListener('input', wordCountOnInput);
		document.addEventListener('selectionchange', wordCountOnSelectionChange);
		wordCountOnInput();
		wordCountOnSelectionChange();
	} else {
		document.removeEventListener('input', wordCountOnInput);
		document.removeEventListener('selectionchange', wordCountOnSelectionChange);
	}
}

var documentWordCount = {};
var selectionWordCount = {};

function wordCountOnInput() {
	documentWordCount = count(document.body.innerText);
	updateWordCountElement();
}

function wordCountOnSelectionChange() {
	selectionWordCount = count(document.getSelection().toString());
	updateWordCountElement();
}

function updateWordCountElement() {
	messageProxy.postMessage({
		command: "wordCountData",
		selection: !document.getSelection().isCollapsed,
		selectionWordCount: selectionWordCount,
		documentWordCount: documentWordCount,
		pages: pages,
	});
}

function count(text) {
	var words = 0;
	var chars = 0;
	var charsWithoutSpaces = 0;
	var wasSpace = true;
	for(var i = 0, len = text.length; i < len; i++) {
		if(/\s/.test(text[i])) {
			if(text[i] !== '\n') {
				chars++;
			}
			wasSpace = true;
		} else {
			chars++;
			charsWithoutSpaces++;
			if(wasSpace) {
				words++;
				wasSpace = false;
			}
		}
	}
	return {
		words: words,
		chars: chars,
		charsWithoutSpaces: charsWithoutSpaces,
	};
}