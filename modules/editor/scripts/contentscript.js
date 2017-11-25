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
      if(evt) evt.stopImmediatePropagation();
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

// Use CSS for style
document.execCommand('styleWithCSS', false, true); // Firefox

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
    'table.default {',
    '  border-collapse: collapse;',
    '}',
    'table.default, table.default td {',
    '  border: 1px solid black;',
    '}',
    'a:link, a:visited {',
    '  color: #0000ee;',
    '}',
    'hr {',
    '  border: none;',
    '  border-bottom: 1px solid black;',
    '}',
  ].join('\n');
  document.head.appendChild(style);
}

// Hide and show toolbar.
// For reviewers, just in case this looks like a security problem:
// This frame is sandboxed, so I had to add the listeners to do this.
// The content CANNOT call any of the parents functions, so this is not a security issue.
if(!readOnly) {
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
}

function updateToolbar() {
  parentMessageProxy.postMessage({
    command: "update-toolbar"
  });
}

// Keyboard shortcuts
document.addEventListener('keypress', function (event) {
  if((event.ctrlKey || event.metaKey) && !event.shiftKey) {
    if(event.which === 98) { // b
      format('bold');
    } else if(event.which === 105) { // i
      format('italic');
    } else if(event.which === 117) { // u
      format('underline');
    } else if(event.which === 13 || event.which === 10) { // enter in FF and Chrome resp. (https://bugs.chromium.org/p/chromium/issues/detail?id=79407)
      document.execCommand('insertHTML', false, '<hr class="page-break">');
      var sel = document.getSelection();
      if(
        sel.anchorOffset &&
        sel.anchorNode.childNodes[sel.anchorOffset - 1].nodeName === 'HR' &&
        !(sel.anchorNode.childNodes[sel.anchorOffset] && sel.anchorNode.childNodes[sel.anchorOffset].nodeType === Node.ELEMENT_NODE)
      ) {
        var p = document.createElement('p');
        p.appendChild(document.createElement('br'));
        sel.anchorNode.appendChild(p);
      }
    } else {
      return;
    }
    event.preventDefault();
    updateToolbar();
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
    updateToolbar();
  }
});

// Select images and text frames on click
function isFrame(element) {
  return element.nodeName === 'IMG' || (element.nodeName === 'DIV' && element.classList.contains('_firetext_frame'));
}
document.addEventListener('click', onFrameClick);
document.addEventListener('contextmenu', onFrameClick);
function onFrameClick(event) {
  if(isFrame(event.target) || event.target.nodeName === 'HR') {
    var range = document.createRange();
    range.selectNode(event.target);
    document.getSelection().removeAllRanges();
    document.getSelection().addRange(range);
  }
}

// Follow links on ctrl/cmd-click
var isMac = navigator.platform.substr(0, 3) === 'Mac';
var ctrlKeyCodes = isMac ? [
  91, // Meta left Chrome / Safari
  93, // Meta right Chrome / Safari
  224, // Meta Firefox
] : [
  17, // Control
];
document.addEventListener('keydown', function(event) {
  if(ctrlKeyCodes.indexOf(event.keyCode) !== -1) {
    document.documentElement.setAttribute('_firetext_ctrl_held', '');
  }
});
document.addEventListener('keyup', function(event) {
  if(ctrlKeyCodes.indexOf(event.keyCode) !== -1) {
    document.documentElement.removeAttribute('_firetext_ctrl_held');
  }
});
document.addEventListener('mousedown', function(event) {
  if(event.target.nodeName === 'A') {
    if(document.documentElement.hasAttribute('_firetext_ctrl_held')) {
      // Document was focused
    } else if(isMac ? event.metaKey : event.ctrlKey) {
      // Document wasn't focused
      document.documentElement.setAttribute('_firetext_ctrl_held', '');
    } else {
      return;
    }
    event.target.setAttribute('contenteditable', 'false');
  }
});

// Keep track of whether mouse is pressed for docIO.js query-command-states handler
window.mousePressed = 0;
document.addEventListener('mousedown', function() {
  window.mousePressed++;
});
document.addEventListener('mouseup', function() {
  window.mousePressed--;
  if(navigator.userAgent.includes('Chrome')) updateToolbar();
});

// Fix up document
document.addEventListener('input', fixupDocument);
fixupDocument();

// night mode
initNight(document, parentMessageProxy);
// print view
initPrintView(document, parentMessageProxy);
// word count
initWordCount(document, parentMessageProxy);
// color picker view
initColorPickerView(document, parentMessageProxy);

// format document
function getSelectedFrame() {
  var sel = document.getSelection();
  if(!sel.rangeCount) {
    return null;
  }
  var range = sel.getRangeAt(0);
  if(
    range.startContainer === range.endContainer &&
    range.startContainer.nodeType === Element.ELEMENT_NODE &&
    range.endOffset - range.startOffset === 1 &&
    isFrame(range.startContainer.childNodes[range.startOffset])
  ) {
    return range.startContainer.childNodes[range.startOffset];
  }
}
function format(cmd, value) {
  /* Duplicated in docIO.js */
  var sel = document.getSelection(), modified = false;
  if(/[^ ] $/.test(sel) && sel.setBaseAndExtent && sel.modify) { // A selection ending in a space, indicating double-clicked word on Windows
    var range = sel.getRangeAt(0);
    sel.setBaseAndExtent(range.startContainer, range.startOffset, range.endContainer, range.endOffset); // Make selection forwards
    sel.modify('extend', 'backward', 'character');
    modified = true;
  }
  if(cmd === 'createLink' || cmd === 'unlink') {
    var range = sel.getRangeAt(0);
    var link = range.commonAncestorContainer.closest('a');
    if(link) {
      sel.selectAllChildren(link);
    }
  }
  document.execCommand(cmd, false, value);
  if(modified) {
    sel.modify('extend', 'forward', 'character');
  }
}
parentMessageProxy.registerMessageHandler(function(e) {
  if(e.data.sCmd.substr(0, 7) === 'justify') {
    var frame = getSelectedFrame();
    if(frame) {
      frame.style.float = frame.style.display = frame.style.marginLeft = frame.style.marginRight = frame.style.marginBottom = '';
      if(e.data.sCmd === 'justifyLeft' || e.data.sCmd === 'justifyRight') {
        frame.style.float = e.data.sCmd === 'justifyLeft' ? 'left' : 'right';
        frame.style[e.data.sCmd === 'justifyLeft' ? 'marginRight' : 'marginLeft'] = '10px';
        frame.style.marginBottom = '5px';
      } else if(e.data.sCmd === 'justifyCenter') {
        frame.style.display = 'block';
        frame.style.marginLeft = frame.style.marginRight = 'auto';
      }
    } else {
      format(e.data.sCmd, e.data.sValue);
    }
    updateToolbar();
  } else if(['superscript', 'subscript'].includes(e.data.sCmd)) {
    // With styleWithCSS, Chrome only applies `vertical-align: super;`,
    // which doesn't make the text smaller (which we want for super/
    // subscript). So we temporarily turn off styleWithCSS to get <sup>/
    // <sub> elements (which Firefox also does even with styleWithCSS.)
    document.execCommand('styleWithCSS', false, false);
    format(e.data.sCmd, e.data.sValue);
    document.execCommand('styleWithCSS', false, true);
  } else {
    format(e.data.sCmd, e.data.sValue);
  }
}, "format")

parentMessageProxy.registerMessageHandler(function(e) {
  var id = randId();
  document.execCommand('insertHTML', false, [
    '<div class="_firetext_frame" style="',
      'float: left;',
      'margin-right: 10px;',
      'margin-bottom: 5px;',
      'border: 1px solid black;',
      'padding: 5px;',
      'width: 300px;',
    '">',
    ' <div class="_firetext_frame_contents">',
    '   <p id="' + id + '"><br></p>',
    ' </div>',
    '</div>'
  ].join('\n'));
  
  /* [Firefox] Put cursor in frame */
  var sel = document.getSelection();
  sel.removeAllRanges();
  var range = document.createRange();
  var p = document.getElementById(id);
  range.setStart(p, 0);
  range.setEnd(p, 0);
  sel.addRange(range);
  p.removeAttribute('id');
}, "insert-text-frame");

function getHTML(doc) {
  /*** This function is duplicated in docIO.js and partially below as getElementInnerHTML ***/
  var doctype = (doc || document).doctype;
  var doctypeString = doctype ? '<!DOCTYPE '
    + doctype.name
    + (doctype.publicId ? ' PUBLIC "' + doctype.publicId + '"' : '')
    + (!doctype.publicId && doctype.systemId ? ' SYSTEM' : '') 
    + (doctype.systemId ? ' "' + doctype.systemId + '"' : '')
    + '>' : '';
  return doctypeString + (doc || document).documentElement.outerHTML.replace(/<([a-z]+)[^>]*_firetext_remove=""[^>]*>[^<>]*(?:<\/\1>)?/g, '').replace(/ _firetext_[a-z_]+=""/g, '').replace(/ contenteditable="(?:true|false)"/g, '').replace(/<p[^>]+collab-added=""[^>]+><br><\/p>(<\/body>)/, '$1').replace(/ collab[-a-z]*="[a-z\d.]*"/g, '').replace(/ spellcheck="(?:true|false)"/, '');
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
var getSelectionRange = function() {
  var selection = document.getSelection();
  return selection.rangeCount ? selection.getRangeAt(0) : null;
}
var prevRange;
function onSelectionChange() {
  var range = getSelectionRange();
  if(range !== prevRange &&
    (!range || !prevRange || ['startContainer', 'startOffset', 'endContainer', 'endOffset'].some(function(attr) {
      return range[attr] !== prevRange[attr];
    }))) {
    updateToolbar();
    if(range && range.collapsed) {
      var nextEl;
      if(
        range.startContainer.childNodes[range.startOffset - 1] &&
        range.startContainer.childNodes[range.startOffset - 1].nodeName === 'HR'
      ) {
        nextEl = range.startContainer.childNodes[range.startOffset - 1].nextElementSibling;
      } else if(
        range.startContainer.childNodes[range.startOffset] &&
        range.startContainer.childNodes[range.startOffset].nodeName === 'HR'
      ) {
        nextEl = range.startContainer.childNodes[range.startOffset].nextElementSibling;
      }
      if(nextEl) {
        range.setStart(nextEl.firstChild && nextEl.firstChild.nodeName !== 'BR' ? nextEl.firstChild : nextEl, 0);
      }
    }
  }
  prevRange = range;
}
document.addEventListener('selectionchange', throttle(onSelectionChange, 100));
if(!('onselectionchange' in document)) { // Firefox <52
  setInterval(onSelectionChange, 100);
}