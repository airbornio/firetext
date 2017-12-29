/*
* IO Handler
* Copyright (C) Codexa Organization.
*/

'use strict';


/* Namespace Container
------------------------*/ 
firetext.io = {};


/* Variables
------------------------*/
var storage, locationDevice;


/* Init
------------------------*/
firetext.io.init = function (api, callback) {
	// Use deviceStorage API
	storage = navigator.getDeviceStorage('sdcard');
	if (!storage) {
		firetext.io.init('file', callback);
		return;
	}
	
	// Check for SD card
	var request = storage.available();

	request.onsuccess = function () {
		// The result is a string
		if (this.result != "available") {
			storage = null;
			firetext.notify(navigator.mozL10n.get('shared-sdcard'));
			firetext.io.init('file', callback);
			return;
		} else {
			storage.onchange = function (change) {
				var fileparts = firetext.io.split(change.path)
				resetPreview(fileparts[0], fileparts[1], fileparts[2], 'internal');
				var location = (document.querySelector('.current') || {}).id;
				if (location == 'welcome' || location == 'welcome-edit-mode' || location == 'open') {
					updateDocLists(['internal', 'recents']);
				}
			}
			enableInternalStorage();
			callback();
		}
	};

	request.onerror = function () {
		storage = null;
		firetext.notify(navigator.mozL10n.get('unable-to-get-sdcard') + this.error.name);
		firetext.io.init('file', callback);
		return;
	};
}

function enableInternalStorage() {	
	// Create storage option
	locationDevice = document.createElement('option');
	locationDevice.value = 'internal';
	locationDevice.setAttribute('data-l10n-id','internal-storage');
	locationDevice.textContent = navigator.mozL10n.get('internal-storage');
	locationSelect.appendChild(locationDevice);
	updateAddDialog();	
}


/* Directory IO
------------------------*/
firetext.io.enumerate = function (directory, callback) {
	if (directory) {
		// List of files
		var FILES = [];
		
		// Put directory in proper form
		if (directory[0] == '/') {
			directory = directory.slice(1);
		}
		if (directory[directory.length - 1] != '/') {
			directory = (directory + '/');
		}
	
		// Get all the files in the specified directory
		if (directory == '/') {
			var cursor = storage.enumerate();
		} else {
			var cursor = storage.enumerate(directory.substring(0, -1));
		}
	
		cursor.onerror = function() {
			if (cursor.error.name == 'SecurityError') {
				firetext.notify(navigator.mozL10n.get('allow-sdcard'));
			} else {
				firetext.notify(navigator.mozL10n.get('load-unsuccessful')+cursor.error.name);
			}
		};
		cursor.onsuccess = function() {
			// Get file
			var file = cursor.result;
		
			// Base case
			if (!cursor.result) {						 
				// Finish
				callback(FILES);
				return FILES;
			}
			
			// Split name into parts
			var thisFile = firetext.io.split(file.name);
			thisFile[3] = file.type;
			thisFile[4] = 'internal';
			thisFile[5] = file.lastModifiedDate;
			
			// Don't get any files but docs
			if (!thisFile[1] |
					 thisFile[3] != 'text/html' &&
					 thisFile[3] != 'text/plain' &&
					 thisFile[2] != '.odt') {
				cursor.continue();
				return;				 
			}
			
			// Remove duplicates
			for (var i = 0; i < FILES.length; i++) {
				if (FILES[i][0] == thisFile[0] && FILES[i][1] == thisFile[1] && FILES[i][2] == thisFile[2]) {
				FILES.splice(i, 1);
				break;
			}
			}
			
			// Put file directory in proper form
			if (!thisFile[0] | thisFile[0] == '') {
				thisFile[0] = '/';
			}
			
			// Add to list of files
			FILES.push(thisFile);
		
			// Check next file
			cursor.continue();
		};
		return FILES;
	}
};


/* File IO
------------------------*/

function createAndOpen(location, directory, filename, filetype, contentBlob) {
	// Save the file
	if (!location | location == '' | location == 'internal') {	
		if (directory[0] !== '/') {
			directory = '/sdcard/' + directory;
		}
		var filePath = directory.replace('/sdcard/', '/Documents/') + filename + filetype;
		airborn.fs.getFile(airborn.path.dirname(filePath), {codec: 'dir'}, function(contents) {
			if(contents && contents.hasOwnProperty(airborn.path.basename(filePath))) {
				firetext.notify(navigator.mozL10n.get('file-exists'));
				return;
			}
			airborn.fs.putFile(filePath, {codec: contentBlob.codec}, contentBlob.content, {type: contentBlob.type}, function(err) {
				if (err) {
					firetext.notify(navigator.mozL10n.get('file-creation-fail')+err.statusText);
					return;
				}
				
				// Load to editor
				loadToEditor(directory, filename, filetype, 'internal');
				
				// Update list
				updateDocLists(['internal']);
			});
		});
	} else {
		firetext.notify(navigator.mozL10n.get('invalid-location'));
	}
}

function createFromDialog() {
	var directory = 'Documents/';
	var location = document.getElementById('createDialogFileLocation').value; // Moved back and forth in regions.js
	var filename = document.getElementById('createDialogFileName').value;
	var filetype = document.getElementById('createDialogFileType').value;
	if (filename == null | filename == undefined | filename == '')	{
		firetext.notify(navigator.mozL10n.get('enter-name'));
		return;
	} else if (!isValidFileName(filename)) {
		firetext.notify(navigator.mozL10n.get('contains-special-characters'));
		return;
	}
	
	// Navigate back to the previous screen
	regions.navBack();
	
	// Convert location to lower case
	location = location.toLowerCase();
	
	// Get default file contents
	var contentData = firetext.io.getDefaultContent(filetype);
	
	// Get mime
	var type =  firetext.io.getMime(filetype);
	
	var contentBlob = {content: contentData, codec: 'utf8String', type: type};
	
	createAndOpen(location, directory, filename, filetype, contentBlob);
}

function uploadFromDialog() {
	var directory = 'Documents/';
	var location = document.getElementById('createDialogFileLocation').value; // Moved back and forth in regions.js
	var files = document.getElementById('uploadDialogFiles').files;
	
	// Navigate back to the previous screen
	regions.navBack();
	
	// Convert location to lower case
	location = location.toLowerCase();
	
	for (var i = 0; i < files.length; i++) {
		var file = files[i];
		
		var filename = file.name;
		
		if (filename == null | filename == undefined | filename == '')	{
			continue;
		} else if (!isValidFileName(filename)) {
			firetext.notify(navigator.mozL10n.get('contains-special-characters'));
			continue;
		}
		
		if (['text/html', 'text/plain', 'application/vnd.oasis.opendocument.text'].indexOf(file.type) === -1) {
			continue;
		}
		
		airborn.fs.putFile('/Documents/Documents/' + filename, {codec: 'blob'}, file);
	}
}

function saveAsFromDialog() {
	var directory = 'Documents/';
	var location = document.getElementById('createDialogFileLocation').value; // Moved back and forth in regions.js
	var filename = document.getElementById('saveAsDialogFileName').value;
	var filetype = document.getElementById('currentFileType').textContent; // Current filetype
	if (filename == null | filename == undefined | filename == '')	{
		firetext.notify(navigator.mozL10n.get('enter-name'));
		return;
	} else if (!isValidFileName(filename)) {
		firetext.notify(navigator.mozL10n.get('contains-special-characters'));
		return;
	}
	
	// Navigate back to the previous screen
	regions.navBack();
	
	// Convert location to lower case
	location = location.toLowerCase();
	
	var key = editorMessageProxy.registerMessageHandler(function(e){
		createAndOpen(location, directory, filename, filetype, e.data);
	}, null, true);
	editorMessageProxy.postMessage({
		command: "get-content-blob",
		key: key
	});
}

function isValidFileName(filename) {
	return !filename.includes('/') && !filename.includes('"');
}

function saveFromEditor(banner, spinner) {
	// Clear save timeout
	saveTimeout = null;

	// Select elements
	var location = document.getElementById('currentFileLocation').textContent;
	var directory = document.getElementById('currentFileDirectory').textContent;
	var filename = document.getElementById('currentFileName').textContent;
	var filetype = document.getElementById('currentFileType').textContent;

	var key = editorMessageProxy.registerMessageHandler(function(e){
		firetext.io.save(directory, filename, filetype, e.data, banner, function(){ fileChanged = false; }, location, spinner);
	}, null, true);
	editorMessageProxy.postMessage({
		command: "get-content-blob",
		key: key
	});
}

function download() {
	// Select elements
	var location = document.getElementById('currentFileLocation').textContent;
	var directory = document.getElementById('currentFileDirectory').textContent;
	var filename = document.getElementById('currentFileName').textContent;
	var filetype = document.getElementById('currentFileType').textContent;

	var key = editorMessageProxy.registerMessageHandler(function(e){
		saveAs(new Blob([e.data.content], {type: e.data.type}), filename + filetype);
	}, null, true);
	editorMessageProxy.postMessage({
		command: "get-content-blob",
		key: key
	});
}

function loadToEditor(directory, filename, filetype, location, editable, fromHistory) {
	// Reset variables
	tempText = undefined;
	
	// Set file name and type
	currentFileName.textContent = filename;
	currentFileType.textContent = filetype;
	currentFileLocation.textContent = location;
	currentFileDirectory.textContent = directory;
	[].forEach.call(document.getElementsByClassName('file-name'), function(element) {
		element.textContent = filename + filetype;		
	});
	
	// Show/hide toolbar
	if (deviceType == 'desktop') {
		document.getElementById('edit-bar').classList.remove('hidden');
	}
	
	// Fill editor
	firetext.io.load(directory, filename, filetype, function(result, error, fileInfo) {
		if (!error) {
			initEditor(filetype, function() {
				editorMessageProxy.postMessage({
					command: "load",
					content: result,
					filename: filename,
					filetype: filetype,
					user_location: user_location,
					readOnly: editable == false,
				});

				firetext.shared.updateCollab(location + fileInfo.slice(0, 3).join(''));

				switch (filetype) {
					case ".txt":
						document.querySelector('[data-tab-id="raw"]').classList.add('hidden-item');
						tabRaw.classList.add('hidden-item');
						document.getElementById('rich-tools').classList.add('hidden-item');
						break;
					case ".odt":
						document.querySelector('[data-tab-id="raw"]').classList.add('hidden-item');
						tabRaw.classList.add('hidden-item');
						document.getElementById('rich-tools').classList.add('hidden-item');
						break;
					case ".html":
					default:
						document.querySelector('[data-tab-id="raw"]').classList.remove('hidden-item');
						tabRaw.classList.remove('hidden-item');
						document.getElementById('rich-tools').classList.remove('hidden-item');
						tempText = result.replace(/<!--_firetext_import_remove_start-->[\s\S]*?<!--_firetext_import_remove_end-->/g, '');
						break;
				}
				
				if (!fromHistory) {
					// Add file to recent docs
					firetext.recents.add([fileInfo[0], fileInfo[1], fileInfo[2]], location);
					
					// Show editor
					regions.nav('edit');
					regions.tab('design', 'design');
				} else {
					// Show editor
					regions.nav('edit');
					
					// Update history list
					processActions('data-click', document.getElementById('open-history-button'));
					
					// Re-init selected tab
					processActions('data-click', document.querySelector('.selected-tab-button'));
				}
		
				// Hide save button if autosave is enabled
				if (firetext.settings.get('autosave') != 'false') {
					document.getElementById('editorSaveButton').style.display = 'none';
				} else {
					document.getElementById('editorSaveButton').style.display = 'inline-block';
				}
				
				// Re-initialize night
				night();
				
				wordCount();
			})
		} else {
			firetext.notify(navigator.mozL10n.get('load-unsuccessful')+result);
		}
	}, location); 
}

firetext.io.save = function (directory, filename, filetype, contentBlob, showBanner, callback, location, showSpinner) {
	// Set saving to true
	saving = true;

	var filePath = (directory + filename + filetype);
	
	// Start spinner	
	if (showSpinner == true) {
		spinner();
	}
	
	// Save file
	if (directory[0] !== '/') {
		directory = '/sdcard/' + directory;
	}
	firetext.shared.getOptions(location + directory + filename + filetype, function(options) {
		if (options.demo) {
			saving = false;
			// Hide spinner
			if (showSpinner != false) {
				spinner('hide');
			}
			callback();
			return;
		}
		options.codec = contentBlob.codec;
		airborn.fs.putFile(directory.replace('/sdcard/', '/Documents/') + filename + filetype, options, contentBlob.content, {type: contentBlob.type}, function(err) {
			saving = false;
			if (showSpinner == true) {
				spinner('hide');
			}
			if (err) {
				firetext.notify(navigator.mozL10n.get('save-unsuccessful') + err.statusText);
				return;
			}
			if (showBanner) {
				showSaveBanner(directory + filename + filetype);
			}
			callback();
		});
	});
};

firetext.io.load = function (directory, filename, filetype, callback, location, showSpinner) {
	if (!directory | !filename | !filetype | !callback) {
		return;
	}
	
	// Show spinner
	if (showSpinner != false) {
		spinner();
	}

	// Put directory in proper form
	if (directory[directory.length - 1] != '/') {
		directory = (directory + '/');
	}
	if (directory == '/' && directory.length == 1) {
		directory = '';
	}
	
	if (directory[0] !== '/') {
		directory = '/sdcard/' + directory;
	}
	firetext.shared.getOptions(location + directory + filename + filetype, function(options) {
		if (options.demo) {
			// Hide spinner
			if (showSpinner != false) {
				spinner('hide');
			}
			callback(firetext.io.getDefaultContent(filetype), undefined, [directory, filename, filetype]);
			return;
		}
		if (filetype == ".odt") {
			options.codec = 'arrayBuffer';
		}
		airborn.fs.getFile(directory.replace('/sdcard/', '/Documents/') + filename + filetype, options, function(contents, err) {
			// Hide spinner
			if (showSpinner != false) {
				spinner('hide');
			}
			if (err) {
				firetext.notify(navigator.mozL10n.get('load-unsuccessful') + err.statusText);
				return;
			}
			callback(contents, undefined, [directory, filename, filetype]);
		});
	});
};

firetext.io.delete = function (name, location) {
	var path = name;
	var req = storage.delete(path);
	req.onsuccess = function () {
		// Code to show a deleted banner
	}
	req.onerror = function () {
		// Code to show an error banner (the firetext.notify is temporary)
		firetext.notify(navigator.mozL10n.get('delete-unsuccessful')+this.error.name);
	}
};

firetext.io.rename = function (directory, name, type, newname, location) {
	firetext.io.load(directory, name, type, function(result) {
		var fullName = (directory + name + type);
		firetext.io.save(directory, name, type, result, function () {}, location);
		firetext.io.delete(fullName, location);
	}, location);
};

firetext.io.getDefaultContent = function (extension) {
	var contentData;
	switch (extension) {
		case ".html":
			contentData = [
				'<!DOCTYPE html>',
				'<html style="max-width: 690px; position: relative; margin: 0 auto;">',
				'<head>',
				'	<meta charset="utf-8">',
				'	<style>',
				/* The following default style is duplicated in contentscript.js and index.html */
				'	h1 {',
				'		font-size: 1.5em;',
				'		margin: 0;',
				'	}',
				'	h2 {',
				'		font-size: 1.17em;',
				'		margin: 0;',
				'	}',
				'	h3 {',
				'		font-size: 1em;',
				'		margin: 0;',
				'	}',
				'	h4 {',
				'		font-size: 1em;',
				'		font-weight: normal;',
				'		text-decoration: underline;',
				'		margin: 0;',
				'	}',
				'	h5 {',
				'		font-size: 1em;',
				'		color: #555;',
				'		margin: 0;',
				'	}',
				'	h6 {',
				'		font-size: 1em;',
				'		font-weight: normal;',
				'		text-decoration: underline;',
				'		color: #444;',
				'		margin: 0;',
				'	}',
				'	p {',
				'		margin: 0;',
				'	}',
				'	blockquote {',
				'		margin: 0px 0px 0px 40px;',
				'	}',
				'	table.default {',
				'		border-collapse: collapse;',
				'	}',
				'	table.default, table.default td {',
				'		border: 1px solid black;',
				'	}',
				'	a:link, a:visited {',
				'		color: #0000ee;',
				'	}',
				'	hr {',
				'		border: none;',
				'		border-bottom: 1px solid black;',
				'	}',
				'	</style>',
				'</head>',
				'<body>',
				'	<p><br></p>',
				'</body>',
				'</html>',
				''
			].join('\n');
			break;
		case ".txt":
			contentData = ' ';
			break;
		case ".odt":
			contentData = 'blabla';
			break;
		default:
			contentData = ' ';
			break;
	}
	return contentData;
};

firetext.io.getMime = function (extension) {
	var type;
	switch (extension) {
		case ".html":
			type = "text/html";
			break;
		case ".txt":
			type = "text/plain";
			break;
		case ".odt":
			type = "application/vnd.oasis.opendocument.text";
			break;
		default:
			type = "application/octet-stream";
			break;
	}
	return type;
}

firetext.io.split = function (path) {
	var file = new Array();
	file[0] = path.substring(0, (path.lastIndexOf('/') + 1));
	file[1] = path.substring((path.lastIndexOf('/') + 1), path.lastIndexOf('.')).replace(/\//, '');
	file[2] = path.substring(path.lastIndexOf('.'), path.length).replace(/\//, '');
	if (file[1] == '' && file[2] == '') {
		file[0] = (file[0] + file[2]);
		if (file[0][file[0].length - 1] != '/') {
			file[0] = (file[0] + '/');
		}
		file[1] = '';
		file[2] = '';
	}
	return [file[0], file[1], file[2]];
};
