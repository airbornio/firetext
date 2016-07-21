/*
* Regions
* Navigation handler
* Copyright (C) Codexa Organization.
*/

'use strict';


/* Namespace Container
------------------------*/ 
var regions = {};
var awaitingPopState = false;


/* Variables
------------------------*/


/* Navigation
------------------------*/
regions.nav = function (location, histEntry) {
	if (awaitingPopState) {
		setTimeout(regions.nav, 0, location, histEntry);
		return;
	}
	if (editState == true && location == 'edit') {
		editDocs(); // Close edit mode
	}
	if (document.getElementById(location)) {
		if (!document.getElementById(location).classList.contains('parent') &&
			regions.closeOverlay()) {
			setTimeout(regions.nav, deviceType == 'desktop' ? 0 : 500, location, histEntry);
			return;
		}
		
		var locationElement = document.getElementById(location);
		var parentRegion = document.querySelector('.parent');
		if (parentRegion) {
			parentRegion.classList.remove('parent');
		}
		var currentRegion = document.querySelector('.current');
		if (currentRegion) {
			if (locationElement.getAttribute('role') != 'region') {
				currentRegion.classList.add('parent');
			}
			currentRegion.classList.remove('current');
		}
		locationElement.classList.add('current');
		if (histEntry === false || !history.state) {
			history.replaceState({location: location}, '', '');
		} else {
			history.pushState({location: location}, '', '');
		}
		
		/* Remove this section when porting to other projects */
		if (location == 'edit') {
			// Save edit status
			firetext.settings.save('autoload.wasEditing', 'true');
			firetext.settings.save('autoload.dir', document.getElementById('currentFileDirectory').textContent);
			firetext.settings.save('autoload.name', document.getElementById('currentFileName').textContent);
			firetext.settings.save('autoload.ext', document.getElementById('currentFileType').textContent);
			firetext.settings.save('autoload.loc', document.getElementById('currentFileLocation').textContent);
			
			// Lock screen in portrait
			if (screen.lockOrientation) {
				screen.lockOrientation('portrait');
			} else if (screen.mozLockOrientation) {
				screen.mozLockOrientation('portrait');
			}			
		} else {
			if (locationElement.getAttribute('role') === 'region') {
				// Not editing if region
				firetext.settings.save('autoload.wasEditing', 'false');
			}
			
			// Unlock screen
			if (screen.unlockOrientation) {
				screen.unlockOrientation();
			} else if (screen.mozUnlockOrientation) {
				screen.mozUnlockOrientation();
			}
		}

		// Update docs lists
		if (location == 'welcome' || location == 'welcome-edit-mode' || location == 'open') {
			updateDocLists(['all']);
		}
		
		if (location == 'edit') {
			// Focus editor
			setTimeout(function() {
				editor.focus();
			});
		} else if (location != 'welcome-edit-mode') {
			// Focus first input
			setTimeout(function() {
				var input = locationElement.querySelector('input:not([disabled]), .config-dialog select') || locationElement.querySelector('button');
				if (input) {
					editor.blur();
					input.focus();
					if(input.select) input.select();
				}
			});
		}
		
		// Prefill filename and show filetype
		if (location == 'save-as') {
			document.getElementById('saveAsDialogFileName').value = document.getElementById('currentFileName').textContent;
			document.getElementById('saveAsDialogFileType').textContent = document.getElementById('currentFileType').textContent;
		}
		
		// Move file location selector to active region
		if (location == 'create' || location == 'upload' || location == 'save-as') {
			locationElement.getElementsByClassName('button-block')[0].appendChild(locationLegend);
		}
		
		// Document title
		setDocumentTitle();
		/* End of customized section */
	}
}

regions.navBack = function () {
	awaitingPopState = true;
	history.back();
}

regions.sidebar = function (name) {
	if(document.querySelector('.current').id == name) {
		regions.navBack();
	} else {
		regions.nav(name);
	}
};

regions.tab = function (id, name) {
	if (document.getElementById('tab-'+name)) {
		// Unselect previous tab and button
		var previousTab = document.querySelector('.selected-tab');
		if (previousTab) {
			previousTab.classList.remove('selected-tab');
		}
		var previousTabButton = document.querySelector('.selected-tab-button');
		if (previousTabButton) {
			previousTabButton.classList.remove('selected-tab-button');
		}

		// Select tab
		document.getElementById('tab-'+name).classList.add('selected-tab');

		// Select tab button
		var tabButton = document.querySelector('[role="tab-button"][data-tab-id="'+id+'"]');
		if (tabButton) {
			tabButton.classList.add('selected-tab-button');                
		}

		/* Remove this section when porting to other projects */
		if (name === 'raw') {
			setTimeout(function(){rawEditor.focus();},300);
			if (tempText) {
				rawEditor.setValue(tempText);
				tempText = undefined;				
			}
			document.getElementById('edit-bar').classList.add('hidden');
		} else {
			if (document.getElementById('currentFileType').textContent != '.txt' &&
					document.getElementById('currentFileType').textContent != '.odt' &&
					deviceType == 'desktop') {
				document.getElementById('edit-bar').classList.remove('hidden');
			}
			if (editorMessageProxy) {
				editorMessageProxy.postMessage({
					command: "printView",
					printView: id === 'printView'
				});
			}
		}
		/* End of customized section */
	}
};

regions.closeOverlay = function () {
	if (document.querySelector('.current') &&
		(document.querySelector('.current').getAttribute('data-type') == 'sidebar' ||
		document.querySelector('.current').getAttribute('role') == 'dialog' ||
		document.querySelector('.current').getAttribute('role') == 'action')
	) {
		regions.navBack();
		return true;
	}
};

regions.popstate = function(evt) {
	if(evt.state) {
		awaitingPopState = false;
		regions.nav(evt.state.location, false);
	}
};

regions.popstate(history);
window.addEventListener('popstate', regions.popstate);
