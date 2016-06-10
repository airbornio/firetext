/*
* Notifications
* Copyright (C) Codexa Organization.
*/

'use strict';

firetext.notify = function (message, html, time) {
	// Fix variables
	if (!time) {
		time = 5000;
	}
	
	// Create notification
	var notificationContainer = document.createElement('section');
	notificationContainer.setAttribute('role','status');
	
	var notification = document.createElement('div');
	
	var notificationBody = document.createElement('p');
	notificationBody.textContent = message;
	notification.appendChild(notificationBody);
	
	if (html) {
		var notificationHtml = document.createElement('p');
		notificationHtml.classList.add('notification-html');
		notificationHtml.innerHTML = html;
		notification.appendChild(notificationHtml);		
	}
	
	notificationContainer.appendChild(notification);
	document.querySelector('section.current').appendChild(notificationContainer);
	
	setTimeout(function(){
		notification.classList.add('notification-shown');
		
		// Set timeout to hide notification
		setTimeout(function(){
			notification.classList.remove('notification-shown');
			setTimeout(function(){
				notificationContainer.parentElement.removeChild(notificationContainer);
			},300);
		},time);
	}, 100);
};
