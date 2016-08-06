/*
* Cloud Storage
* Copyright (C) Codexa Organization.
*/

'use strict';


/* Variables
------------------------*/
// Namespace
var cloud = {};


/* Cloud
------------------------*/
function _dropboxPopupWindowSpec(popupWidth, popupHeight) {
	var height, popupLeft, popupTop, ref, ref1, ref2, ref3, width, x0, y0;
	x0 = (ref = window.screenX) != null ? ref : window.screenLeft;
	y0 = (ref1 = window.screenY) != null ? ref1 : window.screenTop;
	width = (ref2 = window.outerWidth) != null ? ref2 : document.documentElement.clientWidth;
	height = (ref3 = window.outerHeight) != null ? ref3 : document.documentElement.clientHeight;
	popupLeft = Math.round(x0 + (width - popupWidth) / 2);
	popupTop = Math.round(y0 + (height - popupHeight) / 2.5);
	if (popupLeft < x0) {
		popupLeft = x0;
	}
	if (popupTop < y0) {
		popupTop = y0;
	}
	return ("width=" + popupWidth + ",height=" + popupHeight + ",") + ("left=" + popupLeft + ",top=" + popupTop + ",") + 'dialog=yes,dependent=yes,scrollbars=yes,location=yes';
}

function _openDropboxAuthWindow() {
	window._dropboxOauthSigninWindow = window.open(URL.createObjectURL(new Blob([[
		'<script>',
		'window.addEventListener("message", function(evt) {',
		'	if(evt.source === window.opener) {',
		'		window.location = evt.data.url;',
		'	}',
		'});',
		'</script>',
	].join('\n')], {type: 'text/html'})), '_dropboxOauthSigninWindow', _dropboxPopupWindowSpec(980, 700));
}

cloud.init = function (changed) {
	if (firetext.settings.get('dropbox.enabled') == 'true') {
		if (changed) {
			// Pre-open window to circumvent popup blocker
			_openDropboxAuthWindow();
		}
		ljs.load('scripts/cloud/dropbox.min.js', function() {
			// Dropbox
			cloud.dropbox.init();
			
			// Error Handler
			cloud.dropbox.auth.onError.addListener(function (error) {
				if (window.console) {
					console.error(error);
					cloud.dropbox.error(error);
				}
			});
			if (cloud.dropbox.client) {
				if (window._dropboxOauthSigninWindow) {
					window._dropboxOauthSigninWindow.close();
				}
			} else {
				if (!window._dropboxOauthSigninWindow || window._dropboxOauthSigninWindow.closed) {
					_openDropboxAuthWindow();
				}
				// Auth
				cloud.dropbox.auth.authenticate(function(error, client) {
					if (!error && client) {
						// Set client
						cloud.dropbox.client = client;
						
						// Try again to fetch previews for dropfox files
						resetPreviews('dropbox');
						
						// Code to get dropbox files
						updateDocLists(['recents', 'cloud']);
						
						// Show UI elements
						locationDropbox = document.createElement('option');
						locationDropbox.textContent = 'Dropbox';
						locationDropbox.value = 'dropbox';
						locationSelect.appendChild(locationDropbox);
						
						// Dispatch auth event
						window.dispatchEvent(cloud.dropbox.auth.onAuth);
						
						// This is a workaround for a very weird bug...					 
						setTimeout(updateAddDialog, 1);
					} else {
						// Hide/Remove UI elements
						if (locationDropbox) {
							locationSelect.removeChild(locationDropbox);
							locationDropbox = undefined;
						}
					}								 
				});
			} 
		});
		
		// Hide connect button
		mainButtonConnectDropbox.style.display = 'none';
	} else {
		// Hide/Remove UI elements
		if (locationDropbox) {
			locationSelect.removeChild(locationDropbox);
			locationDropbox = undefined;
		}
		
		// Sign out
		if (cloud.dropbox.client) {
			cloud.dropbox.auth.signOut();
			cloud.dropbox.client = undefined;
		}
		
		// Close any open Dropbox files
		if (document.getElementById('currentFileLocation').textContent == 'dropbox') {
			regions.nav('welcome');
			regions.nav('settings');		
		}
		
		// Remove Dropbox recents
		var dropRecents = firetext.recents.get();
		for (var i = 0; i < dropRecents.length; i++) {
			if (dropRecents[i][4] == 'dropbox') {
				firetext.recents.remove(dropRecents[i]);
			}
		}	 
		
		// Update document lists
		updateDocLists(['recents', 'cloud']);
		
		// Show connect button
		mainButtonConnectDropbox.style.display = '';
	}
	
	updateAddDialog();
};
