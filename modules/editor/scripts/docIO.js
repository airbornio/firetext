/*
* Document I/O
* Copyright (C) Codexa Organization 2013.
*/

'use strict'

function initDocIO(document, messageProxy, beforeWrite, afterWrite) {
	/* 0.4
	var docxeditor;
	*/
	var filetype;

	function getHTML() {
		var doctype = document.doctype;
		var doctypeString = '<!DOCTYPE '
			+ doctype.name
			+ (doctype.publicId ? ' PUBLIC "' + doctype.publicId + '"' : '')
			+ (!doctype.publicId && doctype.systemId ? ' SYSTEM' : '') 
			+ (doctype.systemId ? ' "' + doctype.systemId + '"' : '')
			+ '>';
		return doctypeString + document.documentElement.outerHTML.replace(/<style _firetext_remove="">[\s\S]*?<\/style>/, '');
	}
	function getText() {
		return document.documentElement.textContent;
	}

	function watchDocument(filetype) {
		// Add listener to update raw
		document.addEventListener('input', function() {
			messageProxy.getPort().postMessage({
				command: "doc-changed",
				html: getHTML(),
				filetype: filetype
			});
		});
	}

	function load(content, ft) {
		filetype = ft;
		beforeWrite();
		console.log('before open')
		console.log(document, document.open);
		document.open();
		console.log('after open')
		switch (filetype) {
			case ".txt":
				content = firetext.parsers.plain.parse(content, "HTML");
				console.log('before write')
				document.write(content);
				//document.documentElement.innerHTML = content;
				console.log('after write')
				break;
			/* 0.4
			case ".docx":
				docxeditor = new firetext.parsers.DocxEditor(content);
				content = result.HTMLout();
				doc.appendChild(content);
				break;
			*/
			case ".html":
			default:
				console.log('before write')
				if(!/<!DOCTYPE/i.test(content)) content = '<!DOCTYPE html>' + content;
				document.write(content);
				//document.documentElement.innerHTML = content;
				console.log('after write')
				break;
		}
		console.log('before close')
		document.close();
		console.log('after close')
		
		watchDocument(filetype);
		afterWrite();
	}

	messageProxy.registerMessageHandler(function(e) {
		var content;
		var type;
		switch (filetype) {
			case ".html":
				content = getHTML();
				type = "text\/html";
				break;
			case ".txt":
				content = firetext.parsers.plain.encode(getHTML(), "HTML");
				type = "text\/plain";
				break;
			/* 0.4
			case ".docx":
				content = docxeditor.generate("uint8array");
				application/vnd.openxmlformats-officedocument.wordprocessingml.document
				break;
			*/
			default:
				content = getText();
				break;
		}
		
		var contentView = new StringView(content);
		messageProxy.getPort().postMessage({
			command: e.data.key,
			content: contentView.toBase64(),
			type: type
		});
	}, "get-content-blob");

	messageProxy.registerMessageHandler(function(e) {
		load(e.data.content, e.data.filetype);
		if(e.data.key) {
			messageProxy.getPort().postMessage({
				command: e.data.key
			});
		}
	}, "load");

	messageProxy.registerMessageHandler(function(e) {
		var commands = e.data.commands
		var commandStates = {};
		for(var i = 0; i < commands.length; i++) {
			commandStates[commands[i]] = {};
			commandStates[commands[i]].state = document.queryCommandState(commands[i]);
			commandStates[commands[i]].value = document.queryCommandValue(commands[i]);
		}
		messageProxy.getPort().postMessage({
			command: e.data.key,
			commandStates: commandStates
		})
	}, "query-command-states");
}