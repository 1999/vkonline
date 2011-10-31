window.onload = function() {
	var Settings = new AppSettings();
	
	var sound = new Audio();
	sound.src = chrome.extension.getURL('sound/message.mp3');
	
	document.title = chrome.i18n.getMessage('extName');
	var i, select, options, optionsData;
	
	$('#header').html(chrome.i18n.getMessage('extName'));
	$('#content > div.head').html(chrome.i18n.getMessage('options'));

	var author = $('<a>').attr('href', 'http://www.staypositive.ru').html(chrome.i18n.getMessage('author'));
	$('#footer').append([author])
	
	
	// уведомления о статусе
	var status = $('#data').querySelector('div[data-variable="settingsStatus"]');
	status.firstChild.html(chrome.i18n.getMessage('settingsStatus'));
	
	select = $('<select>');
	options = [], optionsData = [['no', 'settingsNo'], ['yes', 'settingsYes']];
	optionsData.forEach(function(data) {
		var option = $('<option>').val(data[0]).html(chrome.i18n.getMessage(data[1]));
		if (Settings.Status === data[0]) {
			option.attr('selected', 'selected');
		}
		
		options.push(option);
	});
	
	select.append(options);
	status.lastChild.append(select);
	
	
	// уведомления о сообщениях
	var mes = $('#data').querySelector('div[data-variable="settingsMessages"]');
	mes.firstChild.html(chrome.i18n.getMessage('settingsMessages'));
	
	select = $('<select>');
	options = [], optionsData = [['no', 'settingsNo'], ['yes', 'settingsYes']];
	optionsData.forEach(function(data) {
		var option = $('<option>').val(data[0]).html(chrome.i18n.getMessage(data[1]));
		if (Settings.Messages === data[0]) {
			option.attr('selected', 'selected');
		}
		
		options.push(option);
	});
	
	select.append(options);
	mes.lastChild.append(select);
	
	
	// уровень звука
	var slevel = $('#data').querySelector('div[data-variable="settingsSoundLevel"]');
	slevel.firstChild.html(chrome.i18n.getMessage('settingsSoundLevel'));
	
	rangeInput = $('<input>').attr({'type' : 'range', 'min' : 0, 'max' : 10, 'step' : 1}).val(parseFloat(Settings.SoundLevel)*10);
	rangeInput.onchange = function() {
		sound.volume = parseInt(rangeInput.val(), 10) / 10;
		sound.play();
	};
	
	slevel.lastChild.append(rangeInput);
	
	
	// домен
	var domain = $('#data').querySelector('div[data-variable="settingsDomain"]');
	domain.firstChild.html(chrome.i18n.getMessage('settingsDomain'));
	
	select = $('<select>');
	options = [], optionsData = [['vkontakte.ru', 'vkontakte.ru'], ['vk.com', 'vk.com']];
	optionsData.forEach(function(data) {
		var option = $('<option>').val(data[0]).html(data[1]);
		if (Settings.Domain === data[0]) {
			option.attr('selected', 'selected');
		}
		
		options.push(option);
	});
	
	select.append(options);
	domain.lastChild.append(select);
	
	
	// открытие окон уведомлений
	var notif = $('#data').querySelector('div[data-variable="settingsOpenNotification"]');
	notif.firstChild.html(chrome.i18n.getMessage('settingsOpenNotification'));
	
	select = $('<select>');
	options = [], optionsData = [['old', 'settingsOpenNotificationOld'], ['new', 'settingsOpenNotificationNew']];
	optionsData.forEach(function(data) {
		var option = $('<option>').val(data[0]).html(chrome.i18n.getMessage(data[1]));
		if (Settings.OpenNotification === data[0]) {
			option.attr('selected', 'selected');
		}
		
		options.push(option);
	});
	
	select.append(options);
	notif.lastChild.append(select);
	
	
	$('#save').html(chrome.i18n.getMessage('saveBtn')).click(function(e) {
		var i, key, rows = $('#data').querySelectorAll('div.trow'), options = {}, formElem;
		for (i=0; i<rows.length; i++) {
			key = rows[i].data('variable').replace('settings', '');
			formElem = rows[i].lastChild.firstChild;
			
			if (key !== 'SoundLevel') {
				Settings[key] = formElem.options[formElem.options.selectedIndex].value;
			} else {
				Settings[key] = formElem.val();
			}
		}
		
		e.target.html(chrome.i18n.getMessage('saveBtnClicked')).attr('disabled', 'disabled');
		chrome.extension.sendRequest({'action' : 'settingsChanged'});
		
		setTimeout(function() {
			e.target.removeAttribute('disabled');
			e.target.html(chrome.i18n.getMessage('saveBtn'));
		}, 1000);
	});
};
