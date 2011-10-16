(function(w) {
	/**
	 * [...] - запрос идет
	 * [?] - нет token, надо разрешить доступ, по клику открывается окно OAuth
	 * [X] - не авторизован ВКонтакте
	 * 
	 * 
	 * var Settings = new AppSettings();
	
	var sounds = {
		'message' : (new Audio).attr('src', chrome.extension.getURL('sound/message.mp3')),
		'error' : (new Audio).attr('src', chrome.extension.getURL('sound/error.mp3')),
		'clear' : (new Audio).attr('src', chrome.extension.getURL('sound/clear.mp3')),
		'sent' : (new Audio).attr('src', chrome.extension.getURL('sound/sent.mp3'))
	};
	 */
	
	var VkAppId = 2642167,
		VkAppScope = ['messages'];
	
	var activeAccount = [false, false];
	var cachedProfiles = {};
	
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
	
	/**
	 * Открытие notification
	 */
	var showNotification = function(data) {
		var person = this;
		
		var notification = window.webkitNotifications.createNotification(person.photo, person.first_name + ' ' + person.last_name, data.message);
		notification.onclick = function() {
			if (typeof data.onclick === 'function') {
				data.onclick.call(notification);
			} else {
				notification.cancel();
			}
		};
		
		notification.show();
		
		// play sound
		//sounds.message.play();
		
		if (typeof data.timeout !== 'undefined') {
			w.setTimeout(function() {
				notification.cancel();
			}, data.timeout*1000);
		}
	};
	
	var req = function(method, params, fnOk, fnFail) {
		var args = arguments,
			self = this;
		
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
				if (xhr.status === 0) { // нет соединения с интернетом
					chrome.browserAction.setIcon({'path' : chrome.extension.getURL('pic/icon19_offline.png')});
					chrome.browserAction.setBadgeText({'text' : ''});
					
					w.setTimeout(function() {
						req.apply(self, args);
					}, 1000);
				} else {
					try {
						var result = JSON.parse(xhr.responseText);
					} catch (e) {
						chrome.browserAction.setIcon({'path' : chrome.extension.getURL('pic/icon19_offline.png')});
						chrome.browserAction.setBadgeText({'text' : ''});
						
						w.setTimeout(function() {
							req.apply(self, args);
						}, 1000);
						
						xhr = null;
						return;
					}
					
					chrome.browserAction.setIcon({'path' : chrome.extension.getURL('pic/icon19.png')});
					if (typeof result.error !== 'undefined') {
						if (typeof fnFail === 'function') {
							fnFail(result.error);
						}
					} else {
						if (typeof fnOk === 'function') {
							fnOk(result.response);
						}
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
	
	var checkUserOnload = function() {
		chrome.browserAction.setBadgeBackgroundColor({'color' : [128, 128, 128, 128]});
		chrome.browserAction.setBadgeText({'text' : '...'});
		
		whoami(function(userId) {
			chrome.browserAction.setBadgeText({'text' : userId});
		}, function() {
			chrome.browserAction.setBadgeText({'text' : 'X'});
		});
	};
	
	/**
	 * Функции-обработчики нажатия на browser action icon
	 */
	var browserActionClickedFn = {
		'guest' : function() {
			chrome.tabs.create({'url' : 'http://vkontakte.ru'});
		},
		'granted' : function() {
			chrome.tabs.create({'url' : 'http://vkontakte.ru/mail'});
		},
		'newbie' : function() {
			chrome.tabs.create({'url' : 'http://api.vkontakte.ru/oauth/authorize?client_id=' + VkAppId + '&scope=' + VkAppScope.join(',') + '&redirect_uri=http://api.vkontakte.ru/blank.html&display=page&response_type=token'});
		}
	};
	
	/**
	 * Привязка обработчика нажатия на browser action icon
	 */
	var browserActionClickedAttach = function(addFnType) {
		Object.keys(browserActionClickedFn).forEach(function(fnType) {
			chrome.browserAction.onClicked.removeListener(browserActionClickedFn[fnType]);
		});
		
		if (typeof addFnType !== 'undefined') {
			chrome.browserAction.onClicked.addListener(browserActionClickedFn[addFnType]);
		}
	};
	
	var startUserSession = function() {
		var activeUid = tokens[activeAccount[1]];
		
		req.call(activeUid, 'messages.getLongPollServer', function(longPollRes) {
			if (tokens[activeAccount[1]] !== activeUid) { // проверка на смену пользователя
				return;
			}
			
			req.call(activeUid, 'messages.get', {'filters' : 1, 'count' : 1}, function(res) {
				var totalNew = (res.constructor === Array) ? res[0] : 0;
				if (tokens[activeAccount[1]] !== activeUid) { // проверка на смену пользователя
					return;
				}
				
				if (totalNew) {
					chrome.browserAction.setBadgeText({'text' : totalNew.toString()});
				} else {
					chrome.browserAction.setBadgeText({'text' : ''});
				}
				
				// начинаем цикл LongPoll-запросов
				(function() {
					var callee = arguments.callee;
					
					var xhr = new XMLHttpRequest(),
						url = 'http://' + longPollRes.server + '?act=a_check&key=' + longPollRes.key + '&ts=' + longPollRes.ts + '&wait=25&mode=0';
					
					xhr.open('GET', url, true);
					xhr.onreadystatechange = function() {
						if (xhr.readyState === 4) {
							if (tokens[activeAccount[1]] !== activeUid) { // проверка на смену пользователя
								return;
							}
							
							if (xhr.status === 0) { // нет соединения с интернетом
								chrome.browserAction.setIcon({'path' : chrome.extension.getURL('pic/icon19_offline.png')});
								/*chrome.browserAction.setBadgeText({'text' : ''});*/
								
								w.setTimeout(callee, 1000);
							} else {
								try {
									var result = JSON.parse(xhr.responseText);
									if (typeof result.failed !== 'undefined') { // ключ устарел (code 2) или такие старые события LongPoll-сервер уже не отдает
										w.setTimeout(startUserSession, 1000);
									} else {
										result.updates.forEach(function(data) {
											switch (data[0]) {
												case 2 :
													if (data[2] & 1) { // отметили как новое
														totalNew += 1;
														chrome.browserAction.setBadgeText({'text' : totalNew.toString()});
													} else if (data[2] & 256) { // прочитано
														totalNew -= 1;
														
														if (totalNew) {
															chrome.browserAction.setBadgeText({'text' : totalNew.toString()});
														} else {
															chrome.browserAction.setBadgeText({'text' : ''});
														}
													}
													
													break;
												
												case 4 :
													if (data[2] & 2) { // исходящее сообщение
														return;
													}
													
													if (data[2] & 1) { // новое
														totalNew += 1;
														chrome.browserAction.setBadgeText({'text' : totalNew.toString()});
														
														var uid = data[3];
														var fn = function() {
															showNotification.call(cachedProfiles[uid], {
																'message' : data[6],
																'timeout' : 3,
																'onclick' : function() {
																	this.cancel();
																	chrome.tabs.create({'url' : 'http://vkontakte.ru/mail?act=show&id=' + data[1]});
																}
															});
														};
														
														if (typeof cachedProfiles[uid] === 'undefined') {
															req.call(activeUid, 'getProfiles', {'uids' : uid, 'fields' : 'first_name,last_name,sex,photo'}, function(res) {
																cachedProfiles[uid] = res[0];
																fn();
															}, function(err) {
																
															});
														} else {
															fn();
														}
													}
													
													break;
												
												case 8 :
													var uid = -data[1];
													var fn = function() {
														var i18msg = (cachedProfiles[uid].sex === '1') ? 'isOnlineF' : 'isOnlineM';
														showNotification.call(cachedProfiles[uid], {
															'message' : chrome.i18n.getMessage(i18msg),
															'timeout' : 3
														});
													};
													
													if (typeof cachedProfiles[uid] === 'undefined') {
														req.call(activeUid, 'getProfiles', {'uids' : uid, 'fields' : 'first_name,last_name,sex,photo'}, function(res) {
															cachedProfiles[uid] = res[0];
															fn();
														}, function(err) {
															
														});
													} else {
														fn();
													}
													
													break;
												
												case 9 :
													var uid = -data[1];
													var fn = function() {
														var i18msg = (cachedProfiles[uid].sex === '1') ? 'isOfflineF' : 'isOfflineM';
														showNotification.call(cachedProfiles[uid], {
															'message' : chrome.i18n.getMessage(i18msg),
															'timeout' : 3
														});
													};
													
													if (typeof cachedProfiles[uid] === 'undefined') {
														req.call(activeUid, 'getProfiles', {'uids' : uid, 'fields' : 'first_name,last_name,sex,photo'}, function(res) {
															cachedProfiles[uid] = res[0];
															fn();
														}, function(err) {
															
														});
													} else {
														fn();
													}
													
													break;
											}
										});
										
										if (tokens[activeAccount[1]] !== activeUid) { // проверка на смену пользователя
											return;
										}
										
										longPollRes.ts = result.ts;
										callee();
									}
								} catch (e) {
									w.setTimeout(callee, 1000);
									
									xhr = null;
									return;
								}
							}
							
							xhr = null;
						}
					};
					
					xhr.send();
				})();
			}, function(err) {
				
			})
		}, function(err) {
			
		});
	};
	
	// запускаем при загрузке
	//checkUserOnload();
	
	
	chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
		switch (request.action) {
			case 'state' :
				if (request.data === false) {
					activeAccount = [false, false];
					
					chrome.browserAction.setBadgeBackgroundColor({'color' : [128, 128, 128, 128]})
					chrome.browserAction.setTitle({'title' : chrome.i18n.getMessage('notAuthorized')});
					chrome.browserAction.setBadgeText({'text' : 'X'});
					
					browserActionClickedAttach('guest');
				} else {
					var fn = function(userId) {
						if (typeof tokens[userId] === 'undefined') { // еще нет доступа
							chrome.browserAction.setBadgeBackgroundColor({'color' : [128, 128, 128, 128]})
							chrome.browserAction.setTitle({'title' : chrome.i18n.getMessage('notGranted')});
							chrome.browserAction.setBadgeText({'text' : '?'});
							
							browserActionClickedAttach('newbie');
						} else {
							chrome.browserAction.setBadgeText({'text' : '...'});
							chrome.browserAction.setBadgeBackgroundColor({'color' : [255, 0, 0, 128]})
							chrome.browserAction.setTitle({'title' : chrome.i18n.getMessage('extName')});
							
							startUserSession();
							browserActionClickedAttach('granted');
						}
					};
					
					if (/^id[0-9]+$/.test(request.data)) {
						if (activeAccount[0] !== request.data) {
							activeAccount = [request.data, request.data.substr(2)];
							fn(request.data.substr(2));
						}
					} else {
						if (activeAccount[0] !== request.data) {
							activeAccount = [request.data, false];
							
							// получаем UID
							req.call(w, 'resolveScreenName', {'screen_name' : request.data}, function(res) {
								activeAccount[1] = res.object_id.toString();
								fn(res.object_id.toString());
							});
						}
					}
				}
				
				break;
			
			case 'auth_success' :
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
				
				chrome.browserAction.setBadgeText({'text' : '...'});
				chrome.browserAction.setBadgeBackgroundColor({'color' : [255, 0, 0, 128]})
				chrome.browserAction.setTitle({'title' : chrome.i18n.getMessage('extName')});
				
				startUserSession();
				browserActionClickedAttach('granted');
				
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
	
	
	w.onerror = function(msg, url, line) {
		alert(msg + ' (line: ' + line + ')');
	};
})(window);