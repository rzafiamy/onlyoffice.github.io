/**
 * Copyright (c) 2006-2020, JGraph Ltd
 * Copyright (c) 2006-2020, Gaudenz Alder
 *
 * Usage: DiagramEditor.editElement(elt) where elt is an img or object with
 * a data URI src or data attribute or an svg node with a content attribute.
 *
 * See https://jgraph.github.io/drawio-integration/javascript.html
 */
function DiagramEditor(config, ui, done, initialized, urlParams, callback, loader)
{
	this.config = (config != null) ? config : this.config;
	this.ui = (ui != null) ? ui : this.ui;
	this.done = (done != null) ? done : this.done;
	this.initialized = (initialized != null) ? initialized : this.initialized;
	this.urlParams = urlParams;
	this.isChanged = false;
	this.isClosePlugin = false;
	this.pluginCallback = callback;
	this.loader = loader;
	this.unsaved_xml = null;
	this.empty_xml = "ddHBDoMgDADQr+GOoIl357bLTh52JtIJCVqDGN2+fhpwjrhdSHktlBTCi3a+WNGrG0owhFE5E34ijGV5uqwrPD2wNEBjtfSU7FDpFwSkQUctYYgKHaJxuo+xxq6D2kUmrMUpLnugibv2ooEDVLUwR71r6ZTXPKO7X0E3auuc0JBpxVYcYFBC4vRFvCS8sIjOR+1cgFlnt83Fnzv/yX4eZqFzPw4swX73sok+iJdv";

	var self = this;

	this.handleMessageEvent = function(evt)
	{
		if (self.frame != null && evt.source == self.frame.contentWindow &&
			evt.data.length > 0)
		{
			try
			{
				var msg = JSON.parse(evt.data);

				if (msg != null)
				{
					self.handleMessage(msg);
				}
			}
			catch (e)
			{
				console.error(e);
			}
		}
	};
};

/**
 * Static method to edit the diagram in the given img or object.
 */
DiagramEditor.editElement = function(arrel, config, ui, done, urlParams, callback, loader)
{
  var elt = arrel[0];
  var div = arrel[1];
  if (!elt.diagramEditorStarting)
  {
    elt.diagramEditorStarting = true;
	var editor =  new DiagramEditor(config, ui, done, function()
    {
        delete elt.diagramEditorStarting;
		div.classList.remove("hidden");
		this.frame.classList.remove("hidden");
    }, urlParams, callback, loader);
    editor.editElement(elt);
	return editor;
   }
};

/**
 * Global configuration.
 */
DiagramEditor.prototype.config = null;

/**
 * Protocol and domain to use.
 */
DiagramEditor.prototype.drawDomain = 'https://embed.diagrams.net/';

/**
 * UI theme to be use.
 */
DiagramEditor.prototype.ui = 'kennedy';

/**
 * Contains XML for pending image export.
 */
DiagramEditor.prototype.xml = null;

/**
 * Format to use.
 */
DiagramEditor.prototype.format = 'xml';

/**
 * Specifies if libraries should be enabled.
 */
DiagramEditor.prototype.libraries = true;

/**
 * CSS style for the iframe.
 */
DiagramEditor.prototype.frameStyle = 'position:absolute;border:0;width:calc(100% - 10px);height:100%;';

/**
 * Adds the iframe and starts editing.
 */
DiagramEditor.prototype.editElement = function(elem)
{
	var src = this.getElementData(elem);
	this.startElement = elem;
	var fmt = this.format;

	if (src.substring(0, 15) === 'data:image/png;')
	{
		fmt = 'xmlpng';
	}
	else if (src.substring(0, 19) === 'data:image/svg+xml;' ||
		elem.nodeName.toLowerCase() == 'svg')
	{
		fmt = 'xmlsvg';
	}

	this.startEditing(src, fmt);

	return this;
};

/**
 * Adds the iframe and starts editing.
 */
DiagramEditor.prototype.getElementData = function(elem)
{
	var name = elem.nodeName.toLowerCase();

	return elem.getAttribute((name == 'svg') ? 'content' :
		((name == 'img') ? 'src' : 'data'));
};

/**
 * Adds the iframe and starts editing.
 */
DiagramEditor.prototype.setElementData = function(elem, data)
{
	var name = elem.nodeName.toLowerCase();

	if (name == 'svg')
	{
		elem.outerHTML = atob(data.substring(data.indexOf(',') + 1));
	}
	else
	{
		elem.setAttribute((name == 'img') ? 'src' : 'data', data);
	}

	return elem;
};

/**
 * Starts the editor for the given data.
 */
DiagramEditor.prototype.startEditing = function(data, format, title)
{
	if (this.frame == null)
	{
		window.addEventListener('message', this.handleMessageEvent);
		this.format = (format != null) ? format : this.format;
		this.title = (title != null) ? title : this.title;
		this.data = data;

		this.frame = this.createFrame(
			this.getFrameUrl(),
			this.getFrameStyle());
		document.body.appendChild(this.frame);
		this.setWaiting(true);
	}
};

/**
 * Updates the waiting cursor.
 */
DiagramEditor.prototype.setWaiting = function(waiting)
{
	if (this.startElement != null)
	{
		// Redirect cursor to parent for SVG and object
		var elt = this.startElement;
		var name = elt.nodeName.toLowerCase();

		if (name == 'svg' || name == 'object')
		{
			elt = elt.parentNode;
		}

		if (elt != null)
		{
			if (waiting)
			{
				this.frame.style.pointerEvents = 'none';
				this.previousCursor = elt.style.cursor;
				elt.style.cursor = 'wait';
			}
			else
			{
				elt.style.cursor = this.previousCursor;
				this.frame.style.pointerEvents = '';
			}
		}
	}
};

/**
 * Updates the waiting cursor.
 */
DiagramEditor.prototype.setActive = function(active)
{
	if (active)
	{
		this.previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
	}
	else
	{
		document.body.style.overflow = this.previousOverflow;
	}
};

/**
 * Removes the iframe.
 */
DiagramEditor.prototype.stopEditing = function()
{
	if (this.frame != null)
	{
		window.removeEventListener('message', this.handleMessageEvent);
		document.body.removeChild(this.frame);
		this.setActive(false);
		this.frame = null;
	}
};

/**
 * Send the given message to the iframe.
 */
DiagramEditor.prototype.postMessage = function(msg)
{
	if (this.frame != null)
	{
		this.frame.contentWindow.postMessage(JSON.stringify(msg), '*');
	}
};

/**
 * Returns the diagram data.
 */
DiagramEditor.prototype.getData = function()
{
	return this.data;
};

/**
 * Returns the title for the editor.
 */
DiagramEditor.prototype.getTitle = function()
{
	return this.title;
};

/**
 * Returns the CSS style for the iframe.
 */
DiagramEditor.prototype.getFrameStyle = function()
{
	// if we use document.body.scrollLeft, we have bug 55144  https://bugzilla.onlyoffice.com/show_bug.cgi?id=55141
	return this.frameStyle + ';left:' +	5 /*document.body.scrollLeft*/ + 'px;' +
		'top:' + document.body.scrollTop + 'px;';
};

/**
 * Returns the URL for the iframe.
 */
DiagramEditor.prototype.getFrameUrl = function()
{
	var url = this.drawDomain + '?proto=json&spin=1';

	if (this.ui != null)
	{
		url += '&ui=' + this.ui;
	}

	if (this.libraries != null)
	{
		url += '&libraries=1';
	}

	if (this.config != null)
	{
		url += '&configure=1';
	}

	if (this.urlParams != null)
	{
		url += '&' + this.urlParams.join('&');
	}

	return url;
};

/**
 * Creates the iframe.
 */
DiagramEditor.prototype.createFrame = function(url, style)
{
	var frame = document.createElement('iframe');
	frame.setAttribute('frameborder', '0');
	frame.setAttribute('style', style);
	frame.setAttribute('src', url);
	frame.classList.add("hidden");
	return frame;
};

/**
 * Sets the status of the editor.
 */
DiagramEditor.prototype.setStatus = function(messageKey, modified)
{
	this.postMessage({action: 'status', messageKey: messageKey, modified: modified});
};

/**
 * Handles the given message.
 */
DiagramEditor.prototype.handleMessage = function(msg)
{
	switch (msg.event) {
		case "configure":
			this.configureEditor();
			break;

		case "init":
			this.initializeEditor();
			break;

		case "autosave":
			// for normal work when you push exit without save
			this.save(msg.xml, true, this.startElement);
			break;

		case "export":
			this.setElementData(this.startElement, msg.data);
			this.stopEditing();
			this.xml = null;
			if (this.isClosePlugin || !this.isChanged) {
				this.isClosePlugin = false;
				this.pluginCallback(this.isChanged);
			}
			break;

		case "save":
			// todo: saving if nothing has changed in a non-empty diagram
			this.save(msg.xml, false, this.startElement);
			if (msg.exit) {
				msg.event = 'exit';
				this.handleMessage(msg);
			}
			else {
				this.setStatus('allChangesSaved', false);
			}
			break;

		case "load":
			this.hideLoader();
			break;

		case "exit":
			this.startElement.classList.remove("hidden");
			if (this.format != 'xml') {
				if (this.xml != null) {
					this.postMessage({action: 'export', format: this.format,
					xml: this.xml, spinKey: 'export'});
				} else {
					this.stopEditing(msg);
					if (!this.isChanged)
						this.pluginCallback(false);
				}
			} else {
				if (msg.modified == null || msg.modified)
					this.save(msg.xml, false, this.startElement);

				this.stopEditing(msg);
			}
			break;
	}
};

/**
 * Posts configure message to editor.
 */
DiagramEditor.prototype.configureEditor = function()
{
	this.postMessage({action: 'configure', config: this.config});
};

/**
 * Posts load message to editor.
 */
DiagramEditor.prototype.initializeEditor = function()
{
	this.postMessage({action: 'load',autosave: 1, saveAndExit: '1',
		modified: 'unsavedChanges', xml: this.getData(),
		title: this.getTitle()});
	this.setWaiting(false);
	this.setActive(true);
    this.initialized();
};

/**
 * Saves the given data.
 */
DiagramEditor.prototype.save = function(data, draft, elt)
{
	if (data.indexOf(this.empty_xml) === -1) 
		this.done(data, draft, elt);
};

/**
 * Invoked after save.
 */
DiagramEditor.prototype.done = function(data, draft)
{
	// hook for subclassers
	if (!draft) {
		this.isChanged = true;
		this.xml = data;
	} else {
		this.unsaved_xml = data;
	}
};

/**
 * Invoked after the editor has sent the init message.
 */
DiagramEditor.prototype.initialized = function()
{
	// hook for subclassers
};

/**
 * Static method to export the diagram when the plugin is closing.
 */
DiagramEditor.prototype.closePlugin = function(bUnsaved)
{
	if (bUnsaved && this.unsaved_xml) {
		this.save(this.unsaved_xml, false);
	}

	this.isClosePlugin = true;
	if (this.isChanged)
		this.postMessage({action: 'export', format: this.format, xml: this.xml, spinKey: 'export'});
	else
		this.pluginCallback(false);

};

/**
 * Static method to hideLoader.
 */
 DiagramEditor.prototype.hideLoader = function()
 {
	this.loader && (this.loader.remove ? this.loader.remove() : $('#loader-container')[0].removeChild(this.loader));
	this.loader = null;
 };