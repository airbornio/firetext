(function(mainOrigin, _parentMessageProxy, initNight, filetype, odtdoc, readOnly) {
  function fixupDocument(evt) {
    if(document.body.children.length === 0) {
      var p = document.createElement('p');
      p.appendChild(document.createElement('br'));
      document.body.appendChild(p);
    }
    if(filetype === '.odt') {
      try {
        odtdoc.setHTML(getHTML());
      } catch(e) {
        document.execCommand('undo');
        evt.stopImmediatePropagation();
      }
    }
  }
  
  var parentMessageProxy = new MessageProxy();
  parentMessageProxy.setSend(parent);
  parentMessageProxy.setRecv(window);
  parentMessageProxy.setMessageHandlers(_parentMessageProxy.getMessageHandlers());
  
  // Initialize Designer
  if(!readOnly) {
    document.documentElement.contentEditable = "true";
    document.execCommand('enableObjectResizing', false, 'true');
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
    }
  });
  
  // Fix up document
  document.addEventListener('input', fixupDocument);
  fixupDocument();
  
  // night mode
  initNight(document, parentMessageProxy);
  
  // format document
  parentMessageProxy.registerMessageHandler(function(e) { document.execCommand(e.data.sCmd, false, e.data.sValue); }, "format")
  
  function getHTML() {
    /*** This function is duplicated in docIO.js and partially below as getElementHTML and getElementOuterHTML ***/
    var doctype = document.doctype;
    var doctypeString = doctype ? '<!DOCTYPE '
      + doctype.name
      + (doctype.publicId ? ' PUBLIC "' + doctype.publicId + '"' : '')
      + (!doctype.publicId && doctype.systemId ? ' SYSTEM' : '') 
      + (doctype.systemId ? ' "' + doctype.systemId + '"' : '')
      + '>' : '';
    return doctypeString + document.documentElement.outerHTML.replace(/<(style|link)[^>]*_firetext_remove=""[^>]*>[^<>]*(?:<\/\1>)?/g, '').replace(' _firetext_night=""', '').replace(/ contenteditable="(?:true|false)"/g, '');
  }
  function getElementHTML(element) {
    return element.innerHTML.replace(/ contenteditable="(?:true|false)"/g, '');
  }
  function getElementOuterHTML(element) {
    return element.outerHTML.replace(/ contenteditable="(?:true|false)"/g, '');
  }

  // Add listener to update raw
  document.addEventListener('input', function() {
    parentMessageProxy.postMessage({
      command: "doc-changed",
      html: getHTML(),
      filetype: filetype
    });
  });
  
  /*** Collaboration ***/
  // General
  var userid = Math.random();
  var blockElementNames = 'address article aside audio blockquote body canvas center dd dir div dl dt fieldset figcaption figure footer form frame frameset h1 h2 h3 h4 h5 h6 header hgroup hr html main menu nav noframes noscript ol output p pre section table tfoot ul video'.split(' ');
  function getLockElement(element) {
    while(blockElementNames.indexOf(element.nodeName.toLowerCase()) === -1) {
      element = element.parentElement;
    }
    return element;
  }
  
  // Sending
  var locksRequested = new Map();
  var prevDocument = document.cloneNode(true);
  function elementPath(element, addToLast) {
    var path = [];
    while(element !== element.ownerDocument.documentElement) {
      var nth = -1, sibling = element;
      while(sibling) {
        sibling = sibling.previousElementSibling;
        nth++;
      }
      path.push(nth + (path.length === 0 ? (addToLast || 0) : 0));
      element = element.parentElement;
    }
    return path.reverse();
  }
  function requestLock(lockElement) {
    if(locksReceived.has(lockElement)) {
      return;
    }
    if(!locksRequested.has(lockElement) || Date.now() - locksRequested.get(lockElement).ts >= 1000) {
      var ts = Date.now();
      var rand = Math.random();
      var path = elementPath(lockElement);
      var html = getElementHTML(elementFromPath(path, prevDocument));
      locksRequested.set(lockElement, {
        ts: ts,
        rand: rand,
        html: html,
        mutations: []
      });
      parentMessageProxy.postMessage({
        command: "collab-message",
        content: {
          type: "lock-request",
          path: path,
          ts: ts,
          rand: rand,
          html: html,
          user: userid
        }
      });
    }
  }
  function showLocked(lockElement) {
    if(lockRequested(lockElement)) {
      if(!lockElement.parentElement) {
        return;
      }
      var localElement = elementFromPath(elementPath(lockElement));
      if(localElement && getElementHTML(localElement) === getElementHTML(lockElement)) {
        localElement.setAttribute('contenteditable', 'true');
        var lockObject = locksRequested.get(lockElement);
        if(lockObject.timeout) {
          clearTimeout(lockObject.timeout);
        }
        lockObject.timeout = setTimeout(function() {
          localElement.removeAttribute('contenteditable');
        }, 3000);
      }
    }
  }
  function lockRequested(element) {
    return locksRequested.has(element) && Date.now() - locksRequested.get(element).ts < 2000;
  }
  function sendMutation(mutationDescription) {
    parentMessageProxy.postMessage({
      command: "collab-message",
      content: {
        type: "mutation",
        mutationDescription: mutationDescription,
        user: userid
      }
    });
  }
  var observer = new MutationObserver(function(mutations) {
    var htmlSentForElements = [];
    mutations.forEach(function(mutation) {
      var mutationDescription, type = mutation.type, target = mutation.target;
      
      if(mutation.attributeName === '_firetext_night') return;
      if(mutation.attributeName === 'contenteditable') return;
      if(!target.parentElement) return;
      
      // Drop redundant or wrong mutations when we've already sent the complete new html
      if((type === 'childList' || type === 'characterData') && htmlSentForElements.some(function(element) {
        return element === target || element.contains(target);
      })) return;
      
      // Avoid locking parent for insertAfter'ed of removed elements
      if(type === 'childList' && !mutation.removedNodes.length && mutation.addedNodes.length === 1 && mutation.addedNodes[0].previousSibling && mutation.addedNodes[0].previousSibling.nodeType === 1) {
        type = 'insertAfter';
        target = mutation.addedNodes[0].previousSibling;
        mutationDescription = {
          action: 'insertAfter',
          target: elementPath(target),
          html: getElementOuterHTML(mutation.addedNodes[0])
        };
        htmlSentForElements.push(mutation.addedNodes[0]);
      } else if(type === 'childList' && !mutation.addedNodes.length && !Array.prototype.some.call(mutation.removedNodes, function(removedNode) {
        return removedNode.nodeType !== 1;
      })) {
        type = 'removeElement';
        for(var i = mutation.removedNodes.length - 1; i >= 0; i--) {
          var path =
            mutation.previousSibling && mutation.previousSibling.parentNode ? elementPath(mutation.previousSibling, 1 + i) :
            mutation.nextSibling && mutation.nextSibling.parentNode ? elementPath(mutation.nextSibling, -1 + mutation.removedNodes.length + i + (mutation.nextSibling.nodeType === 1 ? 0 : 1)) :
            elementPath(mutation.target).concat(i);
          target = elementFromPath(path, prevDocument);
          mutationDescription = {
            action: 'removeElement',
            target: path
          };
          handleMutation();
        }
        return;
      }
      
      handleMutation();
      
      function handleMutation() {
        if(type === 'childList') {
          mutationDescription = {
            action: 'setInnerHTML',
            target: elementPath(target),
            innerHTML: getElementHTML(target)
          };
          htmlSentForElements.push(target);
        } else if(type === 'characterData') {
          mutationDescription = {
            action: 'setInnerHTML',
            target: elementPath(target.parentElement),
            innerHTML: getElementHTML(target.parentElement)
          };
          htmlSentForElements.push(target.parentElement);
        } else if(type === 'attributes') {
          mutationDescription = {
            action: 'modifyAttribute',
            target: elementPath(target),
            attributeName: mutation.attributeName,
            attributeNamespace: mutation.attributeNamespace,
            newValue: target.getAttributeNS(mutation.attributeNamespace, mutation.attributeName)
          };
        }
        
        var lockElement = target;
        if(lockElement.nodeType !== 1) {
          lockElement = lockElement.parentElement;
        }
        if(lockElement.ownerDocument !== prevDocument) {
          lockElement = elementFromPath(elementPath(lockElement), prevDocument);
        }
        lockElement = getLockElement(lockElement);
        if(locksReceived.has(lockElement)) { // Hopefully those mutations come from applyMutation. Ignore them.
          applyMutation(mutationDescription, prevDocument);
          return;
        }
        requestLock(lockElement);
        
        sendMutation(mutationDescription);
        
        var lockObject = lockRequested(lockElement) ? locksRequested.get(lockElement) : locksReceived.get(lockElement);
        lockObject.mutations.push(mutationDescription);
        
        applyMutation(mutationDescription, prevDocument);
        
        showLocked(lockElement);
      }
    });
  });
  observer.observe(document.documentElement, {
    childList: true,
    attributes: true,
    characterData: true,
    subtree: true
  });
  
  // Receiving
  function elementFromPath(path, doc) {
    var element = (doc || document).documentElement;
    for(var i = 0; i < path.length; i++) {
      element = element.children[path[i]];
    }
    return element;
  }
  function applyMutation(mutation, doc) {
    var target = elementFromPath(mutation.target, doc);
    if(mutation.action === 'setInnerHTML') {
      target.innerHTML = mutation.innerHTML;
    } else if(mutation.action === 'insertAfter') {
      var div = (doc || document).createElement('div');
      div.innerHTML = mutation.html;
      target.parentElement.insertBefore(div.firstChild, target.nextSibling);
    } else if(mutation.action === 'removeElement') {
      target.parentElement.removeChild(target);
    } else if(mutation.action === 'modifyAttribute') {
      target.setAttributeNS(mutation.attributeNamespace, mutation.attributeName, mutation.newValue);
    }
  }
  function undoMutations(mutations) {
    mutations.reverse();
    mutations.forEach(function(mutation) {
      var target = elementFromPath(mutation.target);
      if(mutation.action === 'setInnerHTML') {
        // Undone by lock-request
      } else if(mutation.action === 'insertAfter') {
        target.parentElement.removeChild(target.nextSibling);
      } else if(mutation.action === 'removeElement') {
        // Todo
      } else if(mutation.action === 'modifyAttribute') {
        // Todo
      }
    });
  }
  function getPreviousHTML(element, user) {
    return (
      lockRequested(element) ? locksRequested.get(element).html :
      locksReceived.has(element) && locksReceived.get(element).user !== user ? locksReceived.get(element).html :
      getElementHTML(element)
    );
  }
  var locksReceived = new Map();
  parentMessageProxy.registerMessageHandler(function(e) {
    var content = e.data.content;
    if(content.type === 'lock-request') {
      var lockElement = elementFromPath(content.path, prevDocument);
      if(getPreviousHTML(lockElement, content.user) !== content.html) {
        var blockElements = prevDocument.querySelectorAll(blockElementNames.join(','));
        for(var i = 0; i < blockElements.length; i++) {
          if(getPreviousHTML(blockElements[i], content.user) === content.html) {
            lockElement = blockElements[i];
            break;
          }
        }
        if(i === blockElements.length) {
          console.warn("Couldn't find element that has been locked by a collaborator");
        }
      }
      if(lockRequested(lockElement) || locksReceived.has(lockElement)) {
        var lockObject = lockRequested(lockElement) ? locksRequested.get(lockElement) : locksReceived.get(lockElement);
        if(!lockRequested(lockElement) && content.user === lockObject.user) {
          // Same user; extend lock
        } else if(content.ts + content.rand < lockObject.ts + lockObject.rand) {
          undoMutations(lockObject.mutations);
          (lockRequested(lockElement) ? locksRequested : locksReceived).delete(lockElement);
        } else {
          return;
        }
      }
      var localElement = elementFromPath(elementPath(lockElement));
      localElement.innerHTML = content.html;
      localElement.setAttribute('contenteditable', 'false');
      if(locksReceived.has(lockElement)) {
        clearTimeout(locksReceived.get(lockElement).timeout);
      }
      content.timeout = setTimeout(function() {
        locksReceived.delete(lockElement);
        localElement.removeAttribute('contenteditable');
      }, 3000);
      content.mutations = [];
      locksReceived.set(lockElement, content);
    } else if(content.type === 'mutation') {
      var lockElement = getLockElement(elementFromPath(content.mutationDescription.target, prevDocument));
      if(lockRequested(lockElement) || (locksReceived.has(lockElement) && content.user !== locksReceived.get(lockElement).user)) {
        return;
      }
      
      applyMutation(content.mutationDescription);
      
      locksReceived.get(lockElement).mutations.push(content.mutationDescription);
    }
  }, "collab-message");
})(mainOrigin, parentMessageProxy, initNight, filetype, odtdoc, readOnly);
