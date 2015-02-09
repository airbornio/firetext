function initNight(document, messageProxy){
	var dummy = document.createElement('div');
	dummy.innerHTML = [
		'<svg _firetext_remove="" xmlns="http://www.w3.org/2000/svg" version="1.1" x="0" y="0" width="100%" height="100%">',
		'	<defs>',
		'		<filter id="invertColors" x="0" y="0" width="100%" height="100%"',
		'						style="color-interpolation-filters: sRGB">',
		'',
		'			<feImage id="includeImages" result="includeImages" xlink:href="#includeImages" x="0" y="0" width="100%" height="100%" />',
		'			<feColorMatrix in="includeImages" result="excludeImages" type="matrix" values="-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 1 0" />',
		'',
		'			<feColorMatrix in="SourceGraphic" result="inverted" type="matrix" values="-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 1 0" />',
		'			<feColorMatrix in="inverted" result="brightnessInverted" type="hueRotate" values="180" />',
		'',
		'			<feComposite in="brightnessInverted" in2="excludeImages" operator="out" result="nonImagesBrightnessInverted" />',
		'			<feComposite in="SourceGraphic" in2="excludeImages" operator="in" result="images" />',
		'',
		'			<feComposite in="nonImagesBrightnessInverted" in2="images" operator="over" />',
		'',
		'		</filter>',
		'	</defs>',
		'</svg>',
	].join('\n');
	document.body.insertBefore(dummy.firstChild, document.body.firstChild);
	function updateImageLocations() {
		var bodyStyle = window.getComputedStyle(document.body, null);
		var bodyPaddingLeft = parseInt(bodyStyle.getPropertyValue('padding-left'), 10);
		var bodyPaddingTop = parseInt(bodyStyle.getPropertyValue('padding-top'), 10);
		
		var canvas = document.createElement('canvas');
		canvas.width = document.body.offsetWidth;
		canvas.height = document.body.offsetHeight;
		var context = canvas.getContext('2d');
		
		[].forEach.call(document.getElementsByTagName('img'), function(img) {
			context.beginPath();
			context.rect(img.offsetLeft + 5, img.offsetTop + 5, img.offsetWidth, img.offsetHeight);
			context.fill();
		});
		
		document.getElementById('includeImages').setAttribute('xlink:href', canvas.toDataURL());
		
		//document.body.appendChild(canvas);
	}
	function nightEditor(nightMode) {
  		var html = document.getElementsByTagName('html')[0];
		if(nightMode) {
			document.documentElement.setAttribute('_firetext_night', '');
			document.addEventListener('input', updateImageLocations);
			window.addEventListener('load', updateImageLocations);
		} else {
			document.documentElement.removeAttribute('_firetext_night');
			document.removeEventListener('input', updateImageLocations);
		}
	}
	messageProxy.registerMessageHandler(function(e) { nightEditor(e.data.nightMode); }, "night");
}