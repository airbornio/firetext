var blockElementNames = 'address article aside audio blockquote body canvas center dd dir div dl dt fieldset figcaption figure footer form frame frameset h1 h2 h3 h4 h5 h6 header hgroup hr html main menu nav noframes noscript ol output p pre section table tbody td tfoot thead tr ul video'.replace(/ /g, ',');
Node.prototype.closest = function() {
  return this.parentElement.closest.apply(this.parentElement, arguments);
};
function randId(short) {
  var rand = (Math.random() * 16777215).toString(16);
  if(short) {
    return rand.split('.').pop();
  }
  return rand;
}
var userId = randId(true);
function getLockElement(element) {
  return element.closest(blockElementNames);
}
function setElementCollabIDs() {
  var seen = new Map();
  Array.prototype.forEach.call(document.querySelectorAll(blockElementNames.replace('html,', '').replace('body,', '')), function(element) {
    if(!element.hasAttribute('collab-id') || seen.has(element.getAttribute('collab-id'))) { // Chrome duplicates <p> attributes on enter
      element.setAttribute('collab-id', 'c' + randId());
    } else {
      seen.set(element.getAttribute('collab-id'), true);
    }
  });
}
var shadowDocument;
function elementPath(element) {
  var path = [];
  while(element !== element.ownerDocument.documentElement) {
    if(element.hasAttribute && element.hasAttribute('collab-id')) {
      path.push(element.getAttribute('collab-id'));
    } else {
      var nth = -1, sibling = element;
      while(sibling) {
        sibling = sibling.previousSibling;
        nth++;
      }
      path.push(nth);
    }
    element = element.parentElement;
  }
  return path.reverse();
}
function elementFromPath(path, doc, bestEffort) {
  var element = (doc || document).documentElement;
  for(var i = 0; element && i < path.length; i++) {
    if(isFinite(path[i])) {
      element = element.childNodes[path[i]];
    } else {
      element = (doc || document).querySelector('[collab-id="' + path[i] + '"]');
    }
    if(!element && bestEffort) {
      return elementFromPath(path.slice(0, -1), doc);
    }
  }
  return element;
}
var locks = {};
function setLock(edit) {
  locks[edit.el] = edit;
  elementFromPath(edit.el).setAttribute('contenteditable', edit.uid === userId);
}
function getClosestLock(el, userId) {
  for(el = el.slice(); ; el.pop()) {
    if(locks[el] && locks[el].uid === userId) {
      return locks[el];
    }
    if(!el.length) {
      return;
    }
  }
}
function recordSelection() {
  var sel = document.getSelection();
  if(!sel.rangeCount) {
    return null;
  }
  var range = sel.getRangeAt(0);
  return {
    startEl: elementPath(range.startContainer),
    startOffset: range.startOffset,
    endEl: elementPath(range.endContainer),
    endOffset: range.endOffset
  };
}
function setSelection(selection) {
  if(!selection) {
    return;
  }
  
  var range = document.createRange();
  var startEl = elementFromPath(selection.startEl, document, true);
  var endEl = elementFromPath(selection.endEl, document, true);
  range.setStart(startEl, Math.min(selection.startOffset, 'length' in startEl ? startEl.length : startEl.childNodes.length));
  range.setEnd(endEl, Math.min(selection.endOffset, 'length' in endEl ? endEl.length : endEl.childNodes.length));
  var sel = document.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  // Chrome moves the focus to the selection, so we don't need to call `focus`.
  // (https://bugs.webkit.org/show_bug.cgi?id=38696)
  // Except when it doesn't do that. (When the document doesn't have focus?)
  // In which case we still need to call `focus`. But `focus` moves the selection
  // to the start of the document. So we set the selection a second time.
  // (The following code resets the keyboard state to uppercase on Chrome Android,
  // so we rather only execute it when necessary.)
  if(document.activeElement && document.activeElement.id === 'keepKeyboardOpenTextarea') {
    sel.focusNode.closest('[contenteditable="false"] [contenteditable="true"], html').focus();
    sel.removeAllRanges();
    sel.addRange(range);
  }
}
function recordScroll() {
  var sel = document.getSelection();
  if(!sel.rangeCount) {
    return null;
  }
  var rect = sel.getRangeAt(0).getBoundingClientRect();
  if(!rect.left && !rect.top) {
    // getClientRects() is sometimes empty in Chrome (https://crbug.com/238976 ?)
    return null;
  }
  return {
    selectionLeft: rect.left,
    selectionTop: rect.top
  };
}
function setScroll(before) {
  var after = recordScroll();
  if(before && after) {
    window.scrollBy(
      after.selectionLeft - before.selectionLeft,
      after.selectionTop - before.selectionTop
    );
  }
}
function keepKeyboardOpen() {
  var keepKeyboardOpenTextarea = document.getElementById('keepKeyboardOpenTextarea');
  if(!keepKeyboardOpenTextarea) {
    keepKeyboardOpenTextarea = document.createElement('textarea');
    keepKeyboardOpenTextarea.id = 'keepKeyboardOpenTextarea';
    keepKeyboardOpenTextarea.setAttribute('_firetext_remove', '');
    keepKeyboardOpenTextarea.setAttribute('style', 'position: fixed; left: -9999px');
    document.documentElement.appendChild(keepKeyboardOpenTextarea);
  }
  keepKeyboardOpenTextarea.focus();
}
setInterval(function() {
  Array.prototype.forEach.call(document.querySelectorAll('html[contenteditable="false"], html [contenteditable]'), function(element) {
    if(!locks[elementPath(element)]) {
      var selection = recordSelection();
      var scroll = recordScroll();
      keepKeyboardOpen();
      if(element === document.documentElement) {
        element.setAttribute('contenteditable', 'true');
      } else {
        element.removeAttribute('contenteditable');
      }
      if(element.hasAttribute('collab-tmp-lock')) {
        element.removeAttribute('collab-tmp-lock');
      }
      setSelection(selection);
      setScroll(scroll);
    }
  });
}, 100);
function getAttributes(element) {
  var attrs = {};
  [].slice.call(element.attributes).forEach(function(attr) {
    if(attr.name !== 'contenteditable') {
      attrs[attr.name] = attr.value;
    }
  });
  return attrs;
}
function setAttributes(element, attrs) {
  [].slice.call(element.attributes).forEach(function(attr) {
    if(!attrs.hasOwnProperty) {
      element.removeAttribute(attr.name);
    }
  });
  Object.keys(attrs).forEach(function(name) {
    element.setAttribute(name, attrs[name]);
  });
}
function recordEdit(doc, relativeToDoc, element, check) {
  if(!doc) { doc = document; }
  if(!relativeToDoc) { relativeToDoc = shadowDocument.cloneNode(true); }
  if(!element) {
    var sel = doc.getSelection();
    if(sel.rangeCount) {
      element = sel.getRangeAt(0).commonAncestorContainer;
    }
    if(!element || element === doc.documentElement) {
      element = doc.body;
    }
  }
  for(;; element = element.parentElement) {
    if(element === doc.documentElement) {
      throw new Error("Couldn't construct applyable edit.");
    }
    element = getLockElement(element);
    var edit = {
      el: elementPath(element),
      html: getElementInnerHTML(element),
      ts: Date.now(),
      len: ['html', 'body'].indexOf(element.nodeName.toLowerCase()) !== -1 ? 1000 : 10000,
      uid: userId,
    };
    if(check) {
      edit.check = true;
    }
    if(element === doc.body) {
      edit.parentAttrs = getAttributes(element.parentElement);
    }
    applyEdit(edit, relativeToDoc);
    if(element.hasAttribute('collab-added')) {
      element.removeAttribute('collab-added');
      continue;
    }
    if(getHTML(relativeToDoc) === getHTML(doc)) {
      return edit;
    }
  }
}
function applyEdit(edit, doc) {
  var element = elementFromPath(edit.el, doc);
  if(element) {
    if(edit.hasOwnProperty('html') && element.innerHTML !== edit.html) { element.innerHTML = edit.html; }
    if(edit.hasOwnProperty('attrs')) { setAttributes(element, edit.attrs); } // For forward compatibility?
    if(edit.hasOwnProperty('parentAttrs')) { setAttributes(element.parentElement, edit.parentAttrs); }
  }
}
function throttle(fn, time) {
  var timeout, wasCalledSince;
  return function throttled() {
    if(timeout) {
      wasCalledSince = true;
    } else {
      fn.apply(this, arguments);
      wasCalledSince = false;
      timeout = setTimeout(function(args) {
        timeout = null;
        if(wasCalledSince) {
          throttled.apply(this, args);
        }
      }, time, arguments);
    }
  };
}
function debounce(fn, time) {
  var timeout;
  return function() {
    if(timeout) clearTimeout(timeout);
    timeout = setTimeout(function(args) {
      timeout = null;
      fn.apply(this, args);
    }, time, arguments);
  };
}
function checkDocWithPeers() {
  sendEdit(recordEdit(shadowDocument, shadowDocument, shadowDocument.body, true));
}
var checkDocWithPeersDebounced = debounce(function() {
  if(Object.keys(locks).filter(function(el) {
    return !locks[el].tmp && !locks[el].check;
  }).length === 0) {
    checkDocWithPeers();
  }
}, 20000);
function sendEdit(edit) {
  var id = randId(true);
  parentMessageProxy.postMessage({
    command: "collab-message",
    type: "edit",
    data: {
      edit: edit,
      id: id,
      len: edit.len
    }
  });
  collabMessages[id] = edit;
  setLock(edit);
}
var collabMessages = {};
var onInput = function(evt) {
  if(evt.detail === 'fromCollab') {
    return;
  }
  setElementCollabIDs();
  
  var edit;
  try {
    document.getSelection().getRangeAt(0).commonAncestorContainer.normalize();
  } catch(e) {}
  try {
    edit = recordEdit();
  } catch(e) {
    document.execCommand('undo');
    throw e;
  }
  sendEdit(edit);
};
parentMessageProxy.registerMessageHandler(function(e) {
  shadowDocument = document.cloneNode(true);
  document.addEventListener('input', onInput);
}, "collab-enable");
parentMessageProxy.registerMessageHandler(function(e) {
  document.removeEventListener('input', onInput);
}, "collab-disable");
parentMessageProxy.registerMessageHandler(function(e) {
  var type = e.data.type;
  var data = e.data.data;
  if(type === 'lock-end') {
    var edit = collabMessages[data.id];
    delete collabMessages[data.id];
    if(edit && edit === locks[edit.el]) { // Latest lock on the element
      if(!locks[edit.el].check) {
        checkDocWithPeersDebounced();
      }
      delete locks[edit.el];
    }
  } else if(type === 'open') {
    checkDocWithPeers();
  } else if(type === 'edit') {
    if(!locks[data.edit.el] || data.edit.uid === locks[data.edit.el].uid || data.edit.ts < locks[data.edit.el].ts || locks[data.edit.el].tmp || locks[data.edit.el].check) {
      if(!elementFromPath(data.edit.el)) {
        console.warn("Element doesn't exist");
        return;
      }
      var edit = recordEdit();
      var selection = recordSelection();
      var scroll = recordScroll();
      keepKeyboardOpen();
      collabMessages[data.id] = data.edit;
      setLock(data.edit);
      if(edit && !getClosestLock(edit.el, userId) && !locks[edit.el] && elementFromPath(data.edit.el).contains(elementFromPath(edit.el))) {
        edit.tmp = true;
        setLock(edit);
        elementFromPath(edit.el).setAttribute('collab-tmp-lock', '');
      }
      applyEdit(data.edit, shadowDocument);
      recordEdit(shadowDocument, document, elementFromPath(data.edit.el, shadowDocument)); // Implicit applyEdit
      var closestLock;
      if(edit && (closestLock = getClosestLock(edit.el, userId)) && !closestLock.tmp) {
        applyEdit(edit);
      }
      Object.keys(locks).forEach(function(el) {
        var element = elementFromPath(el.split(','));
        if(element && locks[el]) {
          element.setAttribute('contenteditable', locks[el].uid === userId);
          if(locks[el].tmp) {
            element.setAttribute('collab-tmp-lock', '');
          }
        }
      });
      setSelection(selection);
      setScroll(scroll);
      document.dispatchEvent(new CustomEvent('input', {detail: 'fromCollab'}));
    }
  }
}, "collab-message");