function fixupDocument(evt) {
  if(document.body.children.length === 0) {
    if(filetype === '.txt') {
      document.body.appendChild(document.createElement('br'));
    } else {
      var p = document.createElement('p');
      p.appendChild(document.createElement('br'));
      document.body.appendChild(p);
    }
  }
  if(filetype === '.odt') {
    try {
      odtdoc.setHTML(getHTML());
    } catch(e) {
      document.execCommand('undo');
      evt.stopImmediatePropagation();
    }
  }
  // [Collab] If the last <p> is not editable, add an editable <p> after it
  if(
    document.body.lastElementChild &&
    document.body.lastElementChild.nodeName.toLowerCase() === 'p' &&
    document.body.lastElementChild.getAttribute('contenteditable') === 'false'
  ) {
    var p = document.createElement('p');
    p.setAttribute('collab-added', '');
    p.appendChild(document.createElement('br'));
    document.body.appendChild(p);
    setElementCollabIDs();
  }
  if(!document.documentElement.style.getPropertyValue('--width')) {
    document.documentElement.style.setProperty('--width', user_location.country === 'US' ? '8.5in' : '21cm');
  }
  if(!document.documentElement.style.getPropertyValue('--height')) {
    document.documentElement.style.setProperty('--height', user_location.country === 'US' ? '11in' : '29.7cm');
  }
  if(!document.documentElement.style.getPropertyValue('--margin')) {
    document.documentElement.style.setProperty('--margin', '1in');
  }
}

parentMessageProxy.setSend(parent);
parentMessageProxy.setRecv(window);

// Initialize Designer
if(!readOnly) {
  document.documentElement.contentEditable = "true";
  document.execCommand('enableObjectResizing', false, 'true');
}

if(filetype !== '.txt') {
  // Make p, not div
  document.execCommand('defaultParagraphSeparator', false, 'p'); // Chrome
}
if(document.getElementsByTagName('style').length === 0) {
  var style = document.createElement('style');
  style.textContent = [
    /* The following default style is duplicated in io.js and index.html */
    'h1 {',
    '  font-size: 1.5em;',
    '  margin: 0;',
    '}',
    'h2 {',
    '  font-size: 1.17em;',
    '  margin: 0;',
    '}',
    'h3 {',
    '  font-size: 1em;',
    '  margin: 0;',
    '}',
    'h4 {',
    '  font-size: 1em;',
    '  font-weight: normal;',
    '  text-decoration: underline;',
    '  margin: 0;',
    '}',
    'h5 {',
    '  font-size: 1em;',
    '  color: #555;',
    '  margin: 0;',
    '}',
    'h6 {',
    '  font-size: 1em;',
    '  font-weight: normal;',
    '  text-decoration: underline;',
    '  color: #444;',
    '  margin: 0;',
    '}',
    'p {',
    '  margin: 0;',
    '}',
    'blockquote {',
    '  margin: 0px 0px 0px 40px;',
    '}',
    'table.default, table.default td {',
    '  border: 1px solid #afafaf;',
    '}',
  ].join('\n');
  document.head.appendChild(style);
}

// Hide and show toolbar.
// For reviewers, just in case this looks like a security problem:
// This frame is sandboxed, so I had to add the listeners to do this.
// The content CANNOT call any of the parents functions, so this is not a security issue.
window.addEventListener('focus', function (event) {
  parentMessageProxy.postMessage({
    command: "focus",
    focus: true
  });
});
window.addEventListener('blur', function (event) {
  parentMessageProxy.postMessage({
    command: "focus",
    focus: false
  });
});

// Keyboard shortcuts
document.addEventListener('keypress', function (event) {
  if((event.ctrlKey || event.metaKey) && !event.shiftKey) {
    if(event.which === 98) { // b
      document.execCommand('bold');
    } else if(event.which === 105) { // i
      document.execCommand('italic');
    } else if(event.which === 117) { // u
      document.execCommand('underline');
    } else {
      return;
    }
    event.preventDefault();
    parentMessageProxy.postMessage({
      command: "update-toolbar"
    });
  }
});
document.addEventListener('keydown', function (event) {
  if(event.which === 9) { // Tab
    if(event.shiftKey) {
      document.execCommand('outdent');
    } else {
      document.execCommand('indent');
    }
    event.preventDefault();
    parentMessageProxy.postMessage({
      command: "update-toolbar"
    });
  }
});

// [Chrome] Select images on click
document.addEventListener('click', onImageClick);
document.addEventListener('contextmenu', onImageClick);
function onImageClick(event) {
  if(event.target.nodeName.toLowerCase() === 'img') {
    var range = document.createRange();
    range.selectNode(event.target);
    document.getSelection().removeAllRanges();
    document.getSelection().addRange(range);
  }
}

// Fix up document
document.addEventListener('input', fixupDocument);
fixupDocument();

// night mode
initNight(document, parentMessageProxy);
// print view
initPrintView(document, parentMessageProxy);

// format document
function getSelectedImage() {
  var sel = document.getSelection();
  if(!sel.rangeCount) {
    return null;
  }
  var range = sel.getRangeAt(0);
  if(
    range.startContainer === range.endContainer &&
    range.startContainer.nodeType === Element.ELEMENT_NODE &&
    range.endOffset - range.startOffset === 1 &&
    range.startContainer.childNodes[range.startOffset].nodeName === 'IMG'
  ) {
    return range.startContainer.childNodes[range.startOffset];
  }
}
parentMessageProxy.registerMessageHandler(function(e) {
  var img;
  if(e.data.sCmd.substr(0, 7) === 'justify' && (img = getSelectedImage())) {
    img.style.float = img.style.display = img.style.marginLeft = img.style.marginRight = img.style.marginBottom = '';
    if(e.data.sCmd === 'justifyLeft' || e.data.sCmd === 'justifyRight') {
      img.style.float = e.data.sCmd === 'justifyLeft' ? 'left' : 'right';
      img.style[e.data.sCmd === 'justifyLeft' ? 'marginRight' : 'marginLeft'] = '10px';
      img.style.marginBottom = '5px';
    } else if(e.data.sCmd === 'justifyCenter') {
      img.style.display = 'block';
      img.style.marginLeft = img.style.marginRight = 'auto';
    }
    return;
  }
  document.execCommand(e.data.sCmd, false, e.data.sValue);
}, "format")

function getHTML(doc) {
  /*** This function is duplicated in docIO.js and partially below as getElementInnerHTML ***/
  var doctype = (doc || document).doctype;
  var doctypeString = doctype ? '<!DOCTYPE '
    + doctype.name
    + (doctype.publicId ? ' PUBLIC "' + doctype.publicId + '"' : '')
    + (!doctype.publicId && doctype.systemId ? ' SYSTEM' : '') 
    + (doctype.systemId ? ' "' + doctype.systemId + '"' : '')
    + '>' : '';
  return doctypeString + (doc || document).documentElement.outerHTML.replace(/<([a-z]+)[^>]*_firetext_remove=""[^>]*>[^<>]*(?:<\/\1>)?/g, '').replace(' _firetext_night=""', '').replace(' _firetext_print_view=""', '').replace(/ contenteditable="(?:true|false)"/g, '').replace(/<p[^>]+collab-added=""[^>]+><br><\/p>(<\/body>)/, '$1').replace(/ collab[-a-z]*="[a-z\d.]*"/g, '');
}
function getElementInnerHTML(element) {
  return element.innerHTML.replace(/ contenteditable="(?:true|false)"/g, ''); // Don't remove collab-id's
}

// Add listener to update raw
document.addEventListener('input', function() {
  parentMessageProxy.postMessage({
    command: "doc-changed",
    html: getHTML(),
    filetype: filetype
  });
});

// Update toolbar on selectionchange
document.addEventListener('selectionchange', throttle(function() {
  parentMessageProxy.postMessage({
    command: "update-toolbar"
  });
}, 100));
if(!('onselectionchange' in document)) { // Firefox
  var getSelectionRange = function() {
    var selection = document.getSelection();
    return selection.rangeCount ? selection.getRangeAt(selection.rangeCount - 1) : null; // Last range to match Firefox behavior
  }
  var prevRange;
  setInterval(function() {
    var range = getSelectionRange();
    if(range !== prevRange &&
      (!range || !prevRange || ['startContainer', 'startOffset', 'endContainer', 'endOffset'].some(function(attr) {
        return range[attr] !== prevRange[attr];
      }))) {
      parentMessageProxy.postMessage({
        command: "update-toolbar"
      });
    }
    prevRange = range;
  }, 100);
}
