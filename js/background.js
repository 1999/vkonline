(function(w) {
	var VkAppId = 2642167,
		VkAppScope = ['messages'];
	
	var req = function(method, params, fnOk, fnFail) {
		if (typeof params === 'function') {
			fnFail = fnOk;
			fnOk = params;
			params = {};
		}
		
		params = params || {};
		if (this !== w) {
			params.access_token = this;
		}
		
		var prop, qsa = [], formData = new FormData();
		Object.keys(params).forEach(function(key) {
			formData.append(key, params[key]);
		});
		
		var xhr = new XMLHttpRequest();
		xhr.open('POST', 'https://api.vkontakte.ru/method/' + method, true);
		
		xhr.onreadystatechange = function() {
			if (xhr.readyState === 4) {
				if (xhr.status === 0) {
					if (typeof fnFail === 'function') {
						fnFail('Can\'t connect to VK API. Maybe internet connection problems?');
						xhr = null;
					}
					
					return;
				}
				
				try {
					var result = JSON.parse(xhr.responseText);
				} catch (e) {
					if (typeof fnFail === 'function') {
						fnFail('Invalid JSON response from VK API: ' + xhr.responseText);
					}
					
					xhr = null;
					Console.trace();
					
					return;
				}
				
				if (typeof result.error !== 'undefined') {
					if (typeof fnFail === 'function') {
						fnFail(result.error);
					}
				} else {
					if (typeof fnOk === 'function') {
						fnOk(result.response);
					}
				}
				
				xhr = null;
			}
		};
		
		xhr.send(formData);
	};
	
	var whoami = function(fnUser, fnGuest) {
		var xhr = new XMLHttpRequest();
		xhr.open('GET', 'http://vkontakte.ru/', true);
		
		xhr.onreadystatechange = function() {
			if (xhr.readyState === 4) {
				var matches = xhr.responseText.match(/<title>(.*)<\/title>/);
				if (matches[1].length <= 7) { // беда с кодировкой ВКонтакте, поэтому легче проверить на длину строки
					var liMatch = xhr.responseText.match(/<li id="myprofile" class="clear_fix">(.*?)<\/li>/);
					var hrefMatch = liMatch[1].match(/href=".*?"/gm);
					var nickname = hrefMatch[1].substring(7, hrefMatch[1].length-1);
					
					if (nickname.substr(0, 2) === 'id') {
						fnUser(nickname.substr(2));
					} else {
						req.call(w, 'resolveScreenName', {'screen_name' : nickname}, function(res) {
							fnUser(res.object_id);
						}, function() {
							
						});
					}
				} else {
					fnGuest();
				}
			}
		};
		
		xhr.send();
	};
	
	var fnOnLoad = function(tab) {
		chrome.browserAction.setBadgeBackgroundColor({'color' : [128, 128, 128, 128]})
		chrome.browserAction.setBadgeText({'text' : '...'});
		
		whoami(function(userId) {
			var tokens = localStorage.getItem('tokens');
			if (tokens === null) {
				tokens = {};
			} else {
				try {
					tokens = JSON.parse(tokens);
				} catch (e) {
					tokens = {};
				}
			}
			
			if (typeof tokens[userId] === 'undefined') {
				chrome.browserAction.setBadgeText({'text' : '?'});
				
				if (typeof tab !== 'undefined') {
					chrome.tabs.create({
						'url' : 'http://api.vkontakte.ru/oauth/authorize?client_id=' + VkAppId + '&scope=' + VkAppScope.join(',') + '&redirect_uri=http://api.vkontakte.ru/blank.html&display=page&response_type=token'
					});
				}
			} else {
				req.call(tokens[userId], 'messages.get', {'filters' : '1', 'limit' : 1}, function(res) {
					var totalNew = (res === 0) ? 0 : res[0];
					
					req.call(tokens[userId], 'messages.getLongPollServer', function(res) {
						// res.ts
					}, function(err) {
						//window.setTimeout(callee, 1000);
					});
				}, function() {
					
				});
				
				chrome.browserAction.setBadgeText({'text' : 'yeah'});
			}
		}, function() {
			chrome.browserAction.setBadgeText({'text' : 'X'});
		});
	};
	
	// запускаем при загрузке
	fnOnLoad();
	
	// и при клике на иконку
	chrome.browserAction.onClicked.addListener(fnOnLoad);
	
	
	chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
		switch (request.action) {
			case 'auth_success' :
				var tokens = localStorage.getItem('tokens');
				if (tokens === null) {
					tokens = {};
				} else {
					try {
						tokens = JSON.parse(tokens);
					} catch (e) {
						tokens = {};
					}
				}
				
				tokens[request.uid] = request.token;
				localStorage.setItem('tokens', JSON.stringify(tokens));
				
				// закрываем окно OAuth
				chrome.windows.getAll({'populate' : true}, function(windows) {
					windows.forEach(function(windowElem) {
						windowElem.tabs.forEach(function(tab) {
							if (tab.url.indexOf('api.vkontakte.ru/blank.html') !== -1) {
								chrome.tabs.remove(tab.id);
							}
						});
					});
				});
				
				// TODO презагрузка бэйджа
				
				break;
			
			case 'auth_fail' :
				// закрываем окно OAuth
				chrome.windows.getAll({'populate' : true}, function(windows) {
					windows.forEach(function(windowElem) {
						windowElem.tabs.forEach(function(tab) {
							if (tab.url.indexOf('api.vkontakte.ru/blank.html') !== -1) {
								chrome.tabs.remove(tab.id);
							}
						});
					});
				});
				
				break;
		}
	});
})(window);



window.onerror = function(msg, url, line) {
	alert(msg + ' (line: ' + line + ')');
};

getReady(function(fsLink, dbLink) {
	var Settings = new AppSettings();
	
	var sounds = {
		'message' : (new Audio).attr('src', chrome.extension.getURL('sound/message.mp3')),
		'error' : (new Audio).attr('src', chrome.extension.getURL('sound/error.mp3')),
		'clear' : (new Audio).attr('src', chrome.extension.getURL('sound/clear.mp3')),
		'sent' : (new Audio).attr('src', chrome.extension.getURL('sound/sent.mp3'))
	};
	
	var VkAppId = 2438161,
		VkAppScope = ['friends', 'messages', 'offline', 'photos', 'audio', 'video', 'docs'];
	
	var cache = {},
		cacheAvatars = {},
		profileStack = [],
		syncProcess = {
			'contacts' : false,
			'inbox' : false,
			'outbox' : false
		};
	
	var showNotification = function(msgId) {
		var profile = this,
			msg = cache[profile[1]].inbox[msgId],
			contact = cache[profile[1]].contacts[msg.uid];
		
		avatarExists(contact, function(blobUrl) {
			var img = new Image();
			img.onload = function() {
				var canvas = document.createElement('canvas').attr({'width' : 50, 'height' : 50});
				canvas.getContext('2d').drawImageCentered(img, 50, 50);
				
				var notification = window.webkitNotifications.createNotification(canvas.toDataURL(), contact.first_name + ' ' + contact.last_name, msg.body.replace(/<br>/g, '\n'));
				notification.onclick = function() {
					notification.cancel();
					
					// ищем вкладку с приложением
					var foundAppTab = false;
					var fn = function() {
						chrome.tabs.create({
							'url' : chrome.extension.getURL('main.html')
						}, function() {
							chrome.extension.sendRequest({'action' : 'notificationClicked', 'mid' : msgId});
						});
					};
							
					chrome.windows.getAll({'populate' : true}, function(windows) {
						if (windows.length === 0) {
							chrome.windows.create({}, fn);
						} else {
							windows.forEach(function(windowElem) {
								windowElem.tabs.forEach(function(tab) {
									if (tab.url === chrome.extension.getURL('main.html')) {
										chrome.windows.update(windowElem.id, {'focused' : true});
										chrome.tabs.update(tab.id, {'selected' : true});
										
										chrome.extension.sendRequest({'action' : 'notificationClicked', 'mid' : msg.mid});
										foundAppTab = true;
									}
								});
							});
							
							// открываем окно приложения
							if (foundAppTab === false) {
								fn();
							}
						}
					});
				};
				
				notification.show();
				
				// play sound
				sounds.message.play();
			};
			
			img.src = blobUrl;
		});
	};
	
	
	
	var reqLongPoll = function() {
		chrome.extension.sendRequest({'action' : 'finishedMailSync'});
		
		var profile = profileStack.last(),
			permStateInbox = localStorage.getItem('perm_inbox_' + profile[1]),
			permStateOutbox = localStorage.getItem('perm_outbox_' + profile[1]),
			pollData = longPollData[profile[1]],
			ts = localStorage.getItem('lpts_' + profile[1]);
		
		if (permStateInbox === null || permStateOutbox === null) {
			mailSyncProcess();
			return;
		}
		
		// получаем параметры LongPoll-сервера, если нужно
		if (typeof pollData === 'undefined') {
			(function() {
				var callee = arguments.callee;
				
				req.call(profile, 'messages.getLongPollServer', function(res) {
					longPollData[profile[1]] = res;
					
					var existingTs = localStorage.getItem('lpts_' + profile[1]);
					if (existingTs === null) {
						localStorage.setItem('lpts_' + profile[1], res.ts);
					}
					
					window.setTimeout(reqLongPoll, 350);
				}, function(err) {
					Console.error(err);
					window.setTimeout(callee, 1000);
				});
			})();
			
			return;
		}
		
		var reqFailFn = function(err) {
			Console.warn(err);
			window.setTimeout(reqLongPoll, 1000);
		};
		
		var xhr = new XMLHttpRequest(),
			url = 'http://' + pollData.server.replace('vkontakte.ru', 'vk.com') + '?act=a_check&key=' + pollData.key + '&ts=' + ts + '&wait=25&mode=2';
		
		xhr.open('GET', url, true);
		xhr.onreadystatechange = function() {
			if (xhr.readyState === 4) {
				if (xhr.status === 0) {
					// уведомление о работе сети
					chrome.extension.sendRequest({'action' : 'networkDown'});
					xhr = null;
					
					reqFailFn('Can\'t connect to VK API. Maybe internet connection problems?');
					return;
				}
				
				// уведомление о работе сети
				chrome.extension.sendRequest({'action' : 'networkUp'});
				
				try {
					var result = JSON.parse(xhr.responseText);
					if (typeof result.failed !== 'undefined') {
						if (result.failed === 2) { // ключ устарел
							Console.warn('LongPoll server key is invalid. Re-requesting a new key...');
							
							(function() {
								var callee = arguments.callee;
								
								req.call(profile, 'messages.getLongPollServer', function(res) {
									longPollData[profile[1]] = res;
									window.setTimeout(reqLongPoll, 350);
								}, function(err) {
									Console.error(err);
									window.setTimeout(callee, 1000);
								});
							})();
						} else {
							localStorage.setItem('lpts_' + profile[1], result.ts);
							
							localStorage.removeItem('perm_inbox_' + profile[1]);
							localStorage.removeItem('perm_outbox_' + profile[1]);
							
							window.setTimeout(mailSyncProcess, 350);
						}
					} else {
						result.updates.forEach(function(data) {
							switch (data[0]) {
								case 2 :
									if (data[2] & 1) { // отметили как новое
										Dbs[profile[1]].markMessageUnread(data[1], function() {
											cache[profile[1]].inbox[data[1]].read_state = 0;
											
											// обновляем кэш на фронте
											var cacheData = {};
											cacheData[data[1]] = cache[profile[1]].inbox[data[1]];
											chrome.extension.sendRequest({'action' : 'updateCache', 'data' : cacheData, 'type' : 'inbox', 'ap' : profile[1]});
										}, dbFailFn);
									} else if (data[2] & 256) { // прочитано
										Dbs[profile[1]].markMessageRead(data[1], function() {
											cache[profile[1]].inbox[data[1]].read_state = 1;
											
											// обновляем кэш на фронте
											var cacheData = {};
											cacheData[data[1]] = cache[profile[1]].inbox[data[1]];
											chrome.extension.sendRequest({'action' : 'updateCache', 'data' : cacheData, 'type' : 'inbox', 'ap' : profile[1]});
										}, dbFailFn);
									}
									
									break;
								
								case 4 :
									var insertMsg = function() {
										var method, type;
										if (data[2] & 2) {
											type = 'outbox';
											method = 'insertOutboxMessage';
										} else {
											type = 'inbox';
											method = 'insertInboxMessage';
										}
										
										var readState = (data[2] & 1) ? 0 : 1;
										
										var attachmentsField = [],
											attachmentsFieldKeys = Object.keys(data[7]),
											i, len, tmp;
										
										if (attachmentsFieldKeys.length) {
											for (i=1, len=Math.floor(attachmentsFieldKeys.length / 2); i<=len; i++) {
												if (typeof data[7]['attach' + i] === 'undefined') {
													break;
												}
												
												tmp = data[7]['attach' + i].split('_');
												attachmentsField.push([data[7]['attach' + i + '_type'], tmp[0], tmp[1]]);
											}
										}
										
										Dbs[profile[1]][method](data[1], data[3], data[4], data[5], data[6], '', readState, attachmentsField, function(localId) {
											Console.log('Message #' + data[1] + ' inserted as ' + localId);
											
											var msg = {
												'date' : data[4],
												'uid' : data[3],
												'mid' : data[1],
												'title' : data[5],
												'body' : data[6],
												'read_state' : readState,
												'attachments' : attachmentsField
											};
											
											cache[profile[1]][type][data[1]] = msg;
											
											// уведомление
											if (readState === 0 && type === 'inbox') {
												showNotification.call(profile, data[1]);
											}
											
											// обновляем кэш на фронте
											var cacheData = {};
											cacheData[data[1]] = msg;
											chrome.extension.sendRequest({'action' : 'updateCache', 'data' : cacheData, 'type' : type, 'ap' : profile[1]});
										}, dbFailFn);
									};
									
									if (typeof cache[profile[1]].contacts[data[3]] === 'undefined') {
										_getOnePerson.call(profile, data[3], insertMsg, insertMsg, function(err) { // ошибка при запросе к API
											Console.warn(err);
											
											// TODO что делать с сообщением?
										});
									} else {
										insertMsg();
									}
									
									break;
								
								case 8 :
									var contact = cache[profile[1]].contacts[-data[1]];
									Console.log(contact.first_name + ' ' + contact.last_name + ' is online');
									break;
								
								case 9 :
									var contact = cache[profile[1]].contacts[-data[1]];
									var reason = (data[2] === 0) ? 'pressed exit' : 'timeout'
									Console.log(contact.first_name + ' ' + contact.last_name + ' is offline (' + reason + ')');
									break;
								
								default :
									Console.log([data[0], data]);
							}
						});
						
						localStorage.setItem('lpts_' + profile[1], result.ts);
						window.setTimeout(reqLongPoll, 1000);
					}
					
					xhr = null;
				} catch (e) {
					Console.warn(xhr.responseText);
					xhr = null;
					
					reqFailFn(e);
					return;
				}
			}
		};
		
		if (localStorage.getItem('a') === 'a') { // простой способ прекратить LongPoll-запросы ;p
			return;
		}
		
		xhr.send();
		Console.log(['req longpoll process', Date.now(), url]);
	};
});
