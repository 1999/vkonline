var AppUI = function() {
	this._appState = 0;
	this._infoTimeouts = {};
};

/**
 * @return уникальный идентификатор сообщения
 */
AppUI.prototype.showInfoMessage = function(text, meta) {
	var self = this;
	meta = meta || {};
	
	if (typeof meta.id === 'undefined') {
		meta.id = 'rm_' + Math.random().toString().substr(2);
	}
	
	if (typeof meta.type === 'undefined') {
		meta.type = 'warn';
	}
	
	var msg = $('#' + meta.id);
	if (msg === null) {
		msg = $('<div>').attr('id', meta.id).addClass(meta.type);
		if (typeof text === 'string') {
			msg.html(text);
		} else {
			msg.append(text);
		}
		
		$('#info').append(msg);
	} else {
		msg.className = '';
		msg.addClass(meta.type);
		
		if (typeof text === 'string') {
			msg.html(text);
		} else {
			msg.append(text);
		}

		// очищаем таймаут закрытия, если он был задан		
		if (typeof self._infoTimeouts[meta.id] !== 'undefined') {
			window.clearTimeout(self._infoTimeouts[meta.id]);
			delete self._infoTimeouts[meta.id];
		}
	}
	
	// задаем таймаут закрытия
	if (typeof meta.timeout !== 'undefined') {
		self._infoTimeouts[meta.id] = window.setTimeout(function() {
			msg.removeElement();
		}, meta.timeout);
	}
	
	return meta.id;
};

AppUI.prototype.cancelInfoMessage = function(id) {
	// очищаем таймаут закрытия, если он был задан		
	if (typeof this._infoTimeouts[id] !== 'undefined') {
		window.clearTimeout(this._infoTimeouts[id]);
		delete this._infoTimeouts[id];
	}
	
	// удаляем сам элемент
	var msg = $('#' + id);
	if (msg !== null) {
		$('#' + id).removeElement();
	}
};

