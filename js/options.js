window.onload = function() {
	var VkAppId = 2642167,
		VkAppScope = ['messages', 'friends'];
	
	var Settings = new AppSettings();
	
	var sound = new Audio();
	sound.src = chrome.extension.getURL('sound/message.mp3');
	
	document.title = chrome.i18n.getMessage('extName');
	var i, select, options, optionsData;
	
	$('#header').html(chrome.i18n.getMessage('extName'));
	$('#content > div.head').html(chrome.i18n.getMessage('options'));

	var author = $('<a>').attr('href', 'http://www.staypositive.ru').html(chrome.i18n.getMessage('author'));
	$('#footer').append([author])
	
	
	// уведомления о статусе (выбор друзей)
	var statusFC = $('#data').querySelector('div[data-variable="settingsLookFor"]');
	statusFC.firstChild.html(chrome.i18n.getMessage('settingsLookFor') + ' (' + Settings.LookFor.length + ')');
	
	if (Settings.Status === 'no') {
		statusFC.addClass('hidden');
	}
	
	var button = $('<button>').html(chrome.i18n.getMessage('settingsLookForChoose') + '...').attr('id', 'choose-friends');
	button.click(function(e) {
		chrome.extension.sendRequest({'action' : 'getActiveUserToken'}, function(token) {
			if (token === false) {
				alert(chrome.i18n.getMessage('youGuest'));
				return;
			}
			
			var xhr = new XMLHttpRequest();
			xhr.open('POST', 'https://api.' + Settings.Domain + '/method/friends.get', true);
			
			xhr.onreadystatechange = function() {
				if (xhr.readyState === 4) {
					if (xhr.status === 0) { // нет соединения с интернетом
						alert(chrome.i18n.getMessage('noInternetConnection'));
					} else {
						try {
							var result = JSON.parse(xhr.responseText);
						} catch (e) {
							alert(e);
							
							xhr = null;
							return;
						}
						
						if (typeof result.error !== 'undefined') {
							if (result.error.error_code === 7) {
								if (confirm(chrome.i18n.getMessage('noFriendsAccess'))) {
									chrome.tabs.create({'url' : 'http://api.' + Settings.Domain + '/oauth/authorize?client_id=' + VkAppId + '&scope=' + VkAppScope.join(',') + '&redirect_uri=http://api.' + Settings.Domain + '/blank.html&display=page&response_type=token'});
								}
							} else {
								alert(result.error.error_msg);
							}
						} else {
							button.attr('disabled', 'disabled');
							
							var friendsList = $('<select>').attr({'multiple' : 'multiple', 'size' : 16, 'id' : 'friends-multiselect'}),
								options = [], friends = [];
							
							result.response.forEach(function(friend) {
								friends.push([friend.uid, friend.first_name, friend.last_name]);
							});
							
							friends.sort(function(a, b) {
								if (a[1] === b[1]) {
									if (a[2] === b[2]) {
										return a[0] - b[0];
									} else {
										return (a[2] > b[2]) ? 1 : -1;
									}
								} else {
									return (a[1] > b[1]) ? 1 : -1;
								}
							});
							
							friends.forEach(function(friend) {
								var option = $('<option>').val(friend[0]).html(friend[1] + ' ' + friend[2]);
								if (Settings.LookFor.indexOf(friend[0]) !== -1) {
									option.attr('selected', 'selected');
								}
								
								options.push(option);
							});
							
							friendsList.append(options);
							
							button.parentNode.append(friendsList);
							button.removeElement();
						}
					}
					
					xhr = null;
				}
			};
			
			var formData = new FormData();
			formData.append('fields', 'uid,first_name,last_name,photo');
			
			if ((button.data('temp_token') || '').length) {
				formData.append('access_token', button.data('temp_token'));
			} else {
				formData.append('access_token', token);
			}
			
			xhr.send(formData);
		});
	});
	
	statusFC.lastChild.append(button);
	
	
	// уведомления о статусе
	var status = $('#data').querySelector('div[data-variable="settingsStatus"]');
	status.firstChild.html(chrome.i18n.getMessage('settingsStatus'));
	
	var statusSelect = $('<select>');
	statusSelect.onchange = function(e) {
		if (statusSelect.options[statusSelect.selectedIndex].value === 'yes') {
			statusFC.removeClass('hidden');
		} else {
			statusFC.addClass('hidden');
		}
	};
	
	options = [], optionsData = [['no', 'settingsNo'], ['yes', 'settingsYes']];
	optionsData.forEach(function(data) {
		var option = $('<option>').val(data[0]).html(chrome.i18n.getMessage(data[1]));
		if (Settings.Status === data[0]) {
			option.attr('selected', 'selected');
		}
		
		options.push(option);
	});
	
	statusSelect.append(options);
	status.lastChild.append(statusSelect);
	
	
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
			
			switch (key) {
				case 'SoundLevel' :
					Settings[key] = formElem.val();
					break;
				
				case 'LookFor' :
					var friendsSelect = $('#friends-multiselect');
					if (friendsSelect !== null) {
						var neededFriends = [];
						
						for (i=0; i<friendsSelect.options.length; i++) {
							if (friendsSelect.options[i].selected) {
								neededFriends.push(parseInt(friendsSelect.options[i].value, 10));
							}
						}
						
						Settings.LookFor = neededFriends;
					}
					
					break;
				
				default :
					Settings[key] = formElem.options[formElem.selectedIndex].value;
			}
		}
		
		e.target.html(chrome.i18n.getMessage('saveBtnClicked')).attr('disabled', 'disabled');
		chrome.extension.sendRequest({'action' : 'settingsChanged'});
		
		setTimeout(function() {
			location.reload();
		}, 1000);
	});
	
	
	chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
		switch (request.action) {
			case 'auth_success' :
				$('#choose-friends').data('temp_token', request.token).click();
				break;
		}
	});
};
