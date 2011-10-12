$ = function(selector) {
	if (selector.substr(0, 1) === '<') {
		return document.createElement(selector.substr(1, selector.length - 2));
	}
	
	var method = (selector.substr(0, 1) === '#' && selector.indexOf(',') === -1) ? 'querySelector' : 'querySelectorAll';
	return document[method](selector);
};

Array.prototype.last = function() {
	return this[this.length - 1];
};

String.prototype.replaceLinks = function() {
	return this.replace(/((http:\/\/[^\/]+)[^\s|\n|<|\t\r]+)/ig, '<a target="_blank" href="$1">$2/...</a>');
};

String.prototype.md5 = function() {
	var safe_add = function(x, y) {
		var lsw = (x & 0xFFFF) + (y & 0xFFFF);
		var msw = (x >> 16) + (y >> 16) + (lsw >> 16);

		return (msw << 16) | (lsw & 0xFFFF);
	}

	var rol = function(num, cnt) {
		return (num << cnt) | (num >>> (32 - cnt));
	}

	var cmn = function(q, a, b, x, s, t) {
		return safe_add(rol(safe_add(safe_add(a, q), safe_add(x, t)), s), b);
	}

	var ff = function(a, b, c, d, x, s, t) {
		return cmn((b & c) | ((~b) & d), a, b, x, s, t);
	}

	var gg = function(a, b, c, d, x, s, t) {
		return cmn((b & d) | (c & (~d)), a, b, x, s, t);
	}

	var hh = function(a, b, c, d, x, s, t) {
		return cmn(b ^ c ^ d, a, b, x, s, t);
	}

	var ii = function(a, b, c, d, x, s, t) {
		return cmn(c ^ (b | (~d)), a, b, x, s, t);
	}

	var coreMD5 = function(x) {
		var olda, oldb, oldc, oldd, i, len=x.length;
		var a = 1732584193;
		var b = -271733879;
		var c = -1732584194;
		var d = 271733878;
		for (i=0; i<len; i+=16) {
			olda = a;
			oldb = b;
			oldc = c;
			oldd = d;

			a = ff(a, b, c, d, x[i + 0], 7, -680876936);
			d = ff(d, a, b, c, x[i + 1], 12, -389564586);
			c = ff(c, d, a, b, x[i + 2], 17, 606105819);
			b = ff(b, c, d, a, x[i + 3], 22, -1044525330);
			a = ff(a, b, c, d, x[i + 4], 7, -176418897);
			d = ff(d, a, b, c, x[i + 5], 12, 1200080426);
			c = ff(c, d, a, b, x[i + 6], 17, -1473231341);
			b = ff(b, c, d, a, x[i + 7], 22, -45705983);
			a = ff(a, b, c, d, x[i + 8], 7, 1770035416);
			d = ff(d, a, b, c, x[i + 9], 12, -1958414417);
			c = ff(c, d, a, b, x[i + 10], 17, -42063);
			b = ff(b, c, d, a, x[i + 11], 22, -1990404162);
			a = ff(a, b, c, d, x[i + 12], 7, 1804603682);
			d = ff(d, a, b, c, x[i + 13], 12, -40341101);
			c = ff(c, d, a, b, x[i + 14], 17, -1502002290);
			b = ff(b, c, d, a, x[i + 15], 22, 1236535329);
			a = gg(a, b, c, d, x[i + 1], 5, -165796510);
			d = gg(d, a, b, c, x[i + 6], 9, -1069501632);
			c = gg(c, d, a, b, x[i + 11], 14, 643717713);
			b = gg(b, c, d, a, x[i + 0], 20, -373897302);
			a = gg(a, b, c, d, x[i + 5], 5, -701558691);
			d = gg(d, a, b, c, x[i + 10], 9, 38016083);
			c = gg(c, d, a, b, x[i + 15], 14, -660478335);
			b = gg(b, c, d, a, x[i + 4], 20, -405537848);
			a = gg(a, b, c, d, x[i + 9], 5, 568446438);
			d = gg(d, a, b, c, x[i + 14], 9, -1019803690);
			c = gg(c, d, a, b, x[i + 3], 14, -187363961);
			b = gg(b, c, d, a, x[i + 8], 20, 1163531501);
			a = gg(a, b, c, d, x[i + 13], 5, -1444681467);
			d = gg(d, a, b, c, x[i + 2], 9, -51403784);
			c = gg(c, d, a, b, x[i + 7], 14, 1735328473);
			b = gg(b, c, d, a, x[i + 12], 20, -1926607734);
			a = hh(a, b, c, d, x[i + 5], 4, -378558);
			d = hh(d, a, b, c, x[i + 8], 11, -2022574463);
			c = hh(c, d, a, b, x[i + 11], 16, 1839030562);
			b = hh(b, c, d, a, x[i + 14], 23, -35309556);
			a = hh(a, b, c, d, x[i + 1], 4, -1530992060);
			d = hh(d, a, b, c, x[i + 4], 11, 1272893353);
			c = hh(c, d, a, b, x[i + 7], 16, -155497632);
			b = hh(b, c, d, a, x[i + 10], 23, -1094730640);
			a = hh(a, b, c, d, x[i + 13], 4, 681279174);
			d = hh(d, a, b, c, x[i + 0], 11, -358537222);
			c = hh(c, d, a, b, x[i + 3], 16, -722521979);
			b = hh(b, c, d, a, x[i + 6], 23, 76029189);
			a = hh(a, b, c, d, x[i + 9], 4, -640364487);
			d = hh(d, a, b, c, x[i + 12], 11, -421815835);
			c = hh(c, d, a, b, x[i + 15], 16, 530742520);
			b = hh(b, c, d, a, x[i + 2], 23, -995338651);
			a = ii(a, b, c, d, x[i + 0], 6, -198630844);
			d = ii(d, a, b, c, x[i + 7], 10, 1126891415);
			c = ii(c, d, a, b, x[i + 14], 15, -1416354905);
			b = ii(b, c, d, a, x[i + 5], 21, -57434055);
			a = ii(a, b, c, d, x[i + 12], 6, 1700485571);
			d = ii(d, a, b, c, x[i + 3], 10, -1894986606);
			c = ii(c, d, a, b, x[i + 10], 15, -1051523);
			b = ii(b, c, d, a, x[i + 1], 21, -2054922799);
			a = ii(a, b, c, d, x[i + 8], 6, 1873313359);
			d = ii(d, a, b, c, x[i + 15], 10, -30611744);
			c = ii(c, d, a, b, x[i + 6], 15, -1560198380);
			b = ii(b, c, d, a, x[i + 13], 21, 1309151649);
			a = ii(a, b, c, d, x[i + 4], 6, -145523070);
			d = ii(d, a, b, c, x[i + 11], 10, -1120210379);
			c = ii(c, d, a, b, x[i + 2], 15, 718787259);
			b = ii(b, c, d, a, x[i + 9], 21, -343485551);
			a = safe_add(a, olda);
			b = safe_add(b, oldb);
			c = safe_add(c, oldc);
			d = safe_add(d, oldd);
		}

		return [a, b, c, d];
	}

	var binl2hex = function(binarray) {
		var hex_tab = "0123456789abcdef", str = "", i, len=binarray.length*4;
		for (i=0; i<len; i++) {
			str += hex_tab.charAt((binarray[i >> 2] >> ((i % 4) * 8 + 4)) & 0xF) + hex_tab.charAt((binarray[i >> 2] >> ((i % 4) * 8)) & 0xF);
		}

		return str;
	}

	var str2binl = function(str) {
		var nblk = ((str.length + 8) >> 6) + 1;
		var blks = [], i, len=nblk*16, j, strlen=str.length;

		for (i=0; i<len; i++) {
			blks.push(0);
		}

		for (j=0; j<strlen; j++) {
			blks[j >> 2] |= (str.charCodeAt(j) & 0xFF) << ((j % 4) * 8);
		}

		blks[j >> 2] |= 0x80 << ((j % 4) * 8);
		blks[nblk*16 - 2] = strlen * 8;

		return blks;
	}

	return binl2hex(coreMD5(str2binl(this)));
};

String.prototype.trim = function() {
	return this.toString().replace(/^\s+/, '').replace(/\s+$/, '');
};

HTMLElement.prototype.hide = function() {
	this.classList.add('hidden');
	return this;
};

HTMLElement.prototype.show = function() {
	this.classList.remove('hidden');
	return this;
};

HTMLElement.prototype.html = function(newHTML) {
	if (typeof newHTML !== 'undefined') {
		this.innerHTML = newHTML;
		return this;
	} else {
		return this.innerHTML;
	}
};

HTMLElement.prototype.empty = function() {
	return this.html('');
};

HTMLElement.prototype.append = function(elements) {
	if (elements.constructor === Array) {
		var frag = document.createDocumentFragment(), i;
		
		for (i=0; i<elements.length; i++) {
			frag.appendChild(elements[i]);
		}

		this.appendChild(frag);
	} else {
		this.appendChild(elements);
	}
	
	return this;
};

HTMLElement.prototype.prepend = function(element) {
	if (this.hasChildNodes() === true) {
		this.insertBefore(element, this.childNodes[0]);
	} else {
		this.append(element);
	}
};

HTMLElement.prototype.removeElement = function() {
	return this.parentNode.removeChild(this);
};

HTMLElement.prototype.data = function(key, value) {
	if (typeof value === 'undefined' && typeof key === 'string') {
		return this.dataset[key];
	}
	
	if (typeof value !== 'undefined') {
		this.dataset[key] = value;
		return this;
	}

	var i, len, keys = Object.keys(key);
	for (i=0, len=keys.length; i<len; i++) {
		this.dataset[ keys[i] ] = key[ keys[i] ];
	}
	
	return this;
};

HTMLElement.prototype.clearData = function(key) {
	delete this.dataset[key];
	return this;
};

HTMLElement.prototype.attr = function(key, value) {
	if (typeof value === 'undefined' && typeof key === 'string') {
		return this.getAttribute(key);
	}

	if (typeof value !== 'undefined') {
		this.setAttribute(key, value);
		return this;
	}
	
	var i, len, keys = Object.keys(key);
	for (i=0, len=keys.length; i<len; i++) {
		this.setAttribute(keys[i], key[keys[i]]);
	}
	
	return this;
};

HTMLElement.prototype.css = function(key, value) {
	if (typeof value === 'undefined' && typeof key === 'string') {
		return this.style[key];
	}
	
	if (typeof value !== 'undefined') {
		this.style[key] = value;
		return this;
	}
	
	Object.keys(key).forEach(function(cssKey) {
		this.style[cssKey] = key[cssKey];
	}, this);
	
	return this;
};

HTMLElement.prototype.addClass = function(className) {
	if (className.constructor === Array) {
		className.forEach(function(simpleClassName) {
			this.classList.add(simpleClassName);
		}, this);
	} else {
		this.classList.add(className);
	}
	
	return this;
};

HTMLElement.prototype.removeClass = function(className) {
	this.classList.remove(className);
	return this;
};

HTMLElement.prototype.hasClass = function(className) {
	return this.classList.contains(className);
};

HTMLElement.prototype.val = function(newValue) {
	if (typeof newValue === 'undefined') {
		return this.value;
	} else {
		this.value = newValue;
		return this;
	}
};

HTMLButtonElement.prototype.click = HTMLElement.prototype.click = function(handler) {
	if (typeof handler === 'function') {
		this.addEventListener('click', handler, false);
	} else {
		var evt = document.createEvent('MouseEvents');
		evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
		
		this.dispatchEvent(evt);
	}
	
	return this;
};

NodeList.prototype.bodyTargetClick = function(event, fn) {
	if (this.length === 0) {
		return true;
	}
	
	var target = event.target;
	while (target !== document.body) {
		if (Array.prototype.indexOf.call(this, target) !== -1) {
			break;
		}
		
		if (target.parentNode === null) {
			target = document.body;
			break;
		}
		
		target = target.parentNode;
	}
	
	if (target === document.body) {
		return true;
	}
	
	var listenerCalledTS = document.body.data('lc' + event.timeStamp) || '';
	if (listenerCalledTS.length) {
		return true;
	}
	
	document.body.data('lc' + event.timeStamp, '1');
	fn.call(this, target);
};

CanvasRenderingContext2D.prototype.drawImageCentered = function(dataImage, imgWidth, imgHeight) {
	var canvas = this.canvas;
	var ratioDst = canvas.width / canvas.height;
	var ratioSrc = imgWidth / imgHeight;
	var dstX, dstY, dstW, dstH, srcX, srcY, srcH, srcW, collapseLevel;

	if (imgWidth <= canvas.width && imgHeight <= canvas.height) {
		dstX = Math.round( (canvas.width - imgWidth) / 2);
		dstY = Math.round( (canvas.height - imgHeight) / 2);

		this.drawImage(dataImage, 0, 0, imgWidth, imgHeight, dstX, dstY, imgWidth, imgHeight);
	} else {
		if (ratioSrc > ratioDst) {
			srcY = 0;
			srcH = imgHeight;
			dstX = 0;
			dstW = canvas.width;
		
			if (imgHeight > canvas.height) {
				collapseLevel = imgHeight / canvas.height;
			
				srcW = canvas.width * collapseLevel;
				srcX = Math.round( ( (imgWidth/collapseLevel - canvas.width) / 2) * collapseLevel);
			
				dstY = 0;
				dstH = canvas.height;
			} else {
				srcW = canvas.width;
				srcX = Math.round( (imgWidth - canvas.width) / 2);
			
				dstY = Math.round( (canvas.height - imgHeight) / 2);
				dstH = imgHeight;
			}
		} else {
			srcX = 0;
			srcW = imgWidth;
			dstY = 0;
			dstH = canvas.height;
		
			if (imgWidth > canvas.width) {
				collapseLevel = imgWidth / canvas.width;
			
				srcH = canvas.height * collapseLevel;
				srcY = Math.round( ( (imgHeight/collapseLevel - canvas.height) / 2) * collapseLevel);
			
				dstX = 0;
				dstW = canvas.width;
			} else {
				srcH = canvas.height;
				srcY = Math.round( (imgHeight - canvas.height) / 2);
			
				dstX = Math.round( (canvas.width - imgWidth) / 2);
				dstW = imgWidth;
			}
		}
		
		this.drawImage(dataImage, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
	}
};

Array.prototype.fill = function(length, value) {
	var i;
	for (i=0; i<length; i++) {
		this.push(value);
	}
	
	return this;
};

getReady = function(callback) {
	var successArguments = [null, null];
	var checkEvery = function(element) {
		return (element !== null);
	};
	
	var fn = function(fsLink, dbLink) {
		if (dbLink === null) {
			successArguments[0] = fsLink;
		} else {
			successArguments[1] = dbLink;
		}
		
		if (successArguments.every(checkEvery)) {
			if (successArguments[0] === -1) {
				successArguments[0] = null;
			}
			
			callback.apply(this, successArguments);
		}
	};

	(window.webkitRequestFileSystem || window.requestFileSystem)(window.PERSISTENT, 0, function(fsLink) {
		fn(fsLink, null);
	}, function() {
		// http://code.google.com/p/chromium/issues/detail?id=94314
		fn(-1, null);
	});
	
	var dbLink = openDatabase('vkoffline', '1.0.1', null, 0);
	fn(null, dbLink);
};
