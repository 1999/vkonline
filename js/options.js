window.onload = function() {
	var Settings = new AppSettings();
	
	var sound = new Audio();
	sound.src = chrome.extension.getURL('sound/message.mp3');
	
	document.title = chrome.i18n.getMessage('appName');
	var i, select, options, optionsData;
	
	$('#header').html(chrome.i18n.getMessage('extName'));
	$('#content > div.head').html(chrome.i18n.getMessage('options'));

	var author = $('<a>').attr('href', 'http://www.staypositive.ru').html(chrome.i18n.getMessage('author'));
	var icons = document.createTextNode(', icons by ');
	var iconsLink = $('<a>').attr('href', 'http://iconza.ru/').html('Iconza');
	$('#footer').append([author, icons, iconsLink])
	
	// сортировка контактов
	var sort = $('#data').querySelector('div[data-variable="settingsSortContacts"]');
	sort.firstChild.html(chrome.i18n.getMessage('settingsSortContacts'));
	
	select = $('<select>');
	options = [], optionsData = [[0, 'settingsSortContactsLast'], [1, 'settingsSortContactsPopular'], [2, 'settingsSortContactsAlpha']];
	optionsData.forEach(function(data) {
		var option = $('<option>').val(data[0]).html(chrome.i18n.getMessage(data[1]));
		if (parseInt(Settings.SortContacts, 10) === data[0]) {
			option.attr('selected', 'selected');
		}
		
		options.push(option);
	});
	
	select.append(options);
	sort.lastChild.append(select);
	
	// уровень звука
	var sort = $('#data').querySelector('div[data-variable="settingsSoundLevel"]');
	sort.firstChild.html(chrome.i18n.getMessage('settingsSoundLevel'));
	
	rangeInput = $('<input>').attr({'type' : 'range', 'min' : 0, 'max' : 10, 'step' : 1}).val(parseFloat(Settings.SoundLevel)*10);
	rangeInput.onchange = function() {
		sound.volume = parseInt(rangeInput.val(), 10) / 10;
		sound.play();
	};
	
	sort.lastChild.append(rangeInput);
	
	// удаление контактов
	var deleteUser = $('#data').querySelector('div[data-variable="settingsDeleteUser"]');
	deleteUser.firstChild.html(chrome.i18n.getMessage('settingsDeleteUser'));
	
	select = $('<select>').attr('disabled', true);
	options = [], optionsData = [[0, 'settingsDeleteUserLocal'], [1, 'settingsDeleteUserFoe'], [2, 'settingsDeleteUserMsgs'], [3, 'settingsDeleteUserEverything']];
	optionsData.forEach(function(data) {
		var option = $('<option>').val(data[0]).html(chrome.i18n.getMessage(data[1]));
		if (parseInt(Settings.DeleteUser, 10) === data[0]) {
			option.attr('selected', 'selected');
		}
		
		options.push(option);
	});
	
	select.append(options);
	deleteUser.lastChild.append(select);
	
	
	$('#save').html(chrome.i18n.getMessage('saveBtn')).click(function(e) {
		var i, key, rows = $('#data').querySelectorAll('div.trow'), options = {}, formElem;
		for (i=0; i<rows.length; i++) {
			key = rows[i].data('variable').replace('settings', '');
			formElem = rows[i].lastChild.firstChild;
			
			if (key !== 'SoundLevel') {
				Settings[key] = formElem.options[formElem.options.selectedIndex].value;
			} else {
				Settings[key] = parseInt(formElem.val(), 10)/10;
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

