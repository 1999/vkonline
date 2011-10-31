(function(w) {
	/**
	 * [...] - запрос идет
	 * [?] - нет token, надо разрешить доступ, по клику открывается окно OAuth
	 * [X] - не авторизован ВКонтакте
	 */
	
	var Settings = new AppSettings();
	
	var VkAppId = 2642167,
		VkAppScope = ['messages'];
	
	var activeAccount = [false, false];
	var cachedProfiles = {};
	
	var sounds = {
		'message' : (new Audio).attr('src', chrome.extension.getURL('sound/message.mp3')),
		'status' : (new Audio).attr('src', chrome.extension.getURL('sound/status.mp3')),
	};
	
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
		var person = this,
			photo = (person === w) ? chrome.extension.getURL('pic/icon50_offline.png') : person.photo,
			author = (person === w) ? 'Внимание' : person.first_name + ' ' + person.last_name,
			message = data.message.replace(/<br\s*\/?>/mg, ' ');
		
		var notification = window.webkitNotifications.createNotification(photo, author, message);
		notification.onclick = function() {
			if (typeof data.onclick === 'function') {
				data.onclick.call(notification);
			} else {
				notification.cancel();
			}
		};
		
		notification.show();
		
		// play sound
		if (typeof data.sound !== 'undefined') {
			sounds[data.sound].play();
		}
		
		if (typeof data.timeout !== 'undefined') {
			w.setTimeout(function() {
				notification.cancel();
			}, data.timeout*1000);
		}
	};
	
	var req = function(method, params, fnOk, retry) {
		var args = Array.prototype.slice.call(arguments, 0),
			self = this;
		
		if (typeof params === 'function') {
			retry = fnOk;
			fnOk = params;
			params = {};
		}
		
		retry = retry || 1;
		params = params || {};
		if (this !== w) {
			params.access_token = this;
		}
		
		var prop, qsa = [], formData = new FormData();
		Object.keys(params).forEach(function(key) {
			formData.append(key, params[key]);
		});
		
		var xhr = new XMLHttpRequest();
		xhr.open('POST', 'https://api.' + Settings.Domain + '/method/' + method, true);
		
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
						var errorCode = parseInt(result.error.error_code, 10);
						if (errorCode === 5 || errorCode === 7) {
							if (result.error.error_msg.indexOf('expired') !== -1) {
								// открыты ли окна браузера
								var notificationNeeded = true;
								chrome.windows.getAll(null, function(windows) {
									if (windows.length) {
										notificationNeeded = false;
									}
								});
								
								if (notificationNeeded) {
									showNotification.call(w, {
										'message' : chrome.i18n.getMessage('tokenExpired'),
										'onclick' : function() {
											this.cancel();
											
											var windowsOpened;
											chrome.windows.getAll(null, function(windows) {
												windowsOpened = (windows.length)
													? true
													: false;
											});
											
											if (windowsOpened) {
												chrome.tabs.create({'url' : 'http://api.' + Settings.Domain + '/oauth/authorize?client_id=' + VkAppId + '&scope=' + VkAppScope.join(',') + '&redirect_uri=http://api.' + Settings.Domain + '/blank.html&display=page&response_type=token'});
											} else {
												chrome.windows.create({'url' : 'http://api.' + Settings.Domain + '/oauth/authorize?client_id=' + VkAppId + '&scope=' + VkAppScope.join(',') + '&redirect_uri=http://api.' + Settings.Domain + '/blank.html&display=page&response_type=token'});
											}
										}
									});
								} else {
									chrome.tabs.create({'url' : 'http://api.' + Settings.Domain + '/oauth/authorize?client_id=' + VkAppId + '&scope=' + VkAppScope.join(',') + '&redirect_uri=http://api.' + Settings.Domain + '/blank.html&display=page&response_type=token'});
								}
								
								return;
							}
							
							if (retry <= 5) {
								w.setTimeout(function() {
									if (typeof args.last() !== 'number') {
										args.push(1);
									} else {
										args[args.length-1] += 1;
									}
									
									req.apply(self, args);
								}, 350);
							} else {
								if (self !== w) {
									// debug purposes only
									localStorage.setItem('__badtoken__' + Date.now() + '__' + activeAccount[1], self);
									
									delete tokens[activeAccount[1]];
									localStorage.setItem('tokens', JSON.stringify(tokens));
									
									chrome.browserAction.setBadgeBackgroundColor({'color' : [128, 128, 128, 128]})
									chrome.browserAction.setTitle({'title' : chrome.i18n.getMessage('notGranted')});
									chrome.browserAction.setBadgeText({'text' : '?'});
									
									browserActionClickedAttach('newbie');
								} else {
									alert('uncaught error: ' + result.error.error_code);
								}
							}
						} else {
							alert('uncaught error: ' + result.error.error_code);
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
		var args = arguments;
		
		var xhr = new XMLHttpRequest();
		xhr.open('GET', 'http://' + Settings.Domain + '/', true);
		
		xhr.onreadystatechange = function() {
			if (xhr.readyState === 4) {
				if (xhr.status === 0) { // нет соединения с интернетом
					chrome.browserAction.setIcon({'path' : chrome.extension.getURL('pic/icon19_offline.png')});
					chrome.browserAction.setBadgeText({'text' : ''});
					
					w.setTimeout(function() {
						whoami.apply(w, args);
					}, 1000);
				} else {
					chrome.browserAction.setIcon({'path' : chrome.extension.getURL('pic/icon19.png')});
					chrome.browserAction.setBadgeText({'text' : ''});
					
					var matches = xhr.responseText.match(/<title>(.*)<\/title>/);
					if (matches[1].length <= 7) { // беда с кодировкой ВКонтакте, поэтому легче проверить на длину строки
						var liMatch = xhr.responseText.match(/<li id="myprofile" class="clear_fix">(.*?)<\/li>/);
						var hrefMatch = liMatch[1].match(/href=".*?"/gm);
						var nickname = hrefMatch[1].substring(7, hrefMatch[1].length-1);
						
						fnUser(nickname);
					} else {
						fnGuest();
					}
				}
			}
		};
		
		xhr.send();
	};
	
	var gotUser = function(nickname) {
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
		
		if (/^id[0-9]+$/.test(nickname)) {
			if (activeAccount[0] !== nickname) {
				activeAccount = [nickname, nickname.substr(2)];
				fn(nickname.substr(2));
			}
		} else {
			if (activeAccount[0] !== nickname) {
				activeAccount = [nickname, false];
				
				// получаем UID
				req.call(w, 'resolveScreenName', {'screen_name' : nickname}, function(res) {
					activeAccount[1] = res.object_id.toString();
					fn(res.object_id.toString());
				});
			}
		}
	};
	
	/**
	 * Функции-обработчики нажатия на browser action icon
	 */
	var browserActionClickedFn = {
		'guest' : function() {
			chrome.tabs.create({'url' : 'http://' + Settings.Domain});
		},
		'granted' : function() {
			chrome.tabs.create({'url' : 'http://' + Settings.Domain + '/mail'});
		},
		'newbie' : function() {
			chrome.tabs.create({'url' : 'http://api.' + Settings.Domain + '/oauth/authorize?client_id=' + VkAppId + '&scope=' + VkAppScope.join(',') + '&redirect_uri=http://api.' + Settings.Domain + '/blank.html&display=page&response_type=token'});
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
					sounds.message.play();
				} else {
					chrome.browserAction.setBadgeText({'text' : ''});
				}
				
				// начинаем цикл LongPoll-запросов
				(function() {
					var callee = arguments.callee;
					
					var xhr = new XMLHttpRequest(),
						server = (Settings.Domain === 'vk.com') ? longPollRes.server.replace('vkontakte.ru', 'vk.com') : longPollRes.server,
						url = 'http://' + server + '?act=a_check&key=' + longPollRes.key + '&ts=' + longPollRes.ts + '&wait=25&mode=0';
					
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
								} catch (e) {
									w.setTimeout(callee, 1000);
									chrome.browserAction.setIcon({'path' : chrome.extension.getURL('pic/icon19_offline.png')});
									
									xhr = null;
									return;
								}
								
								chrome.browserAction.setIcon({'path' : chrome.extension.getURL('pic/icon19.png')});
								if (typeof result.failed !== 'undefined') { // ключ устарел (code 2) или такие старые события LongPoll-сервер уже не отдает
									w.setTimeout(startUserSession, 1000);
								} else {
									result.updates.forEach(function(data) {
										switch (data[0]) {
											case 2 :
												if (data[2] & 1) { // отметили как новое
													totalNew += 1;
													chrome.browserAction.setBadgeText({'text' : totalNew.toString()});
													
													sounds.message.play();
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
													
													// если хотя бы 1 вкладка открыта, не проигрываем звук
													chrome.windows.getAll({'populate' : true}, function(windows) {
														var playSound = true,
															needsNotify = true;
														
														if (windows.length) {
															windows.forEach(function(windowElem) {
																windowElem.tabs.forEach(function(tab) {
																	if (tab.url.indexOf('vkontakte.ru') !== -1 || tab.url.indexOf('vk.com') !== -1) {
																		if (tab.url.indexOf('developers.php') === -1) {
																			playSound = false;
																			
																			if (windowElem.focused === false) {
																				chrome.tabs.update(tab.id, {'selected' : true});
																			} else {
																				if (tab.selected) {
																					needsNotify = false;
																				}
																			}
																		}
																	}
																});
															});
														}
														
														if (Settings.Messages === 'no') { // настройки
															if (playSound) {
																sounds.message.play();
															}
															
															return;
														}
														
														var uid = data[3];
														var fn = function() {
															if (needsNotify === false) {
																return;
															}
															
															var notificationData = {
																'message' : data[6],
																'timeout' : 7,
																'onclick' : function() {
																	this.cancel();
																	chrome.tabs.create({'url' : 'http://' + Settings.Domain + '/mail?act=show&id=' + data[1]});
																}
															};
															
															if (playSound) {
																notificationData.sound = 'message';
															}
															
															showNotification.call(cachedProfiles[uid], notificationData);
														};
														
														if (typeof cachedProfiles[uid] === 'undefined') {
															req.call(activeUid, 'getProfiles', {'uids' : uid, 'fields' : 'first_name,last_name,sex,photo'}, function(res) {
																cachedProfiles[uid] = res[0];
																fn();
															});
														} else {
															fn();
														}
													});
												}
												
												break;
											
											case 8 :
												var uid = -data[1];
												var fn = function() {
													var i18msg = (cachedProfiles[uid].sex === '1') ? 'isOnlineF' : 'isOnlineM';
													showNotification.call(cachedProfiles[uid], {
														'message' : chrome.i18n.getMessage(i18msg),
														'timeout' : 3,
														'sound' : 'status',
														'onclick' : function() {
															this.cancel();
															chrome.tabs.create({'url' : 'http://' + Settings.Domain + '/id' + uid});
														}
													});
												};
												
												if (Settings.Status === 'no') { // настройки
													return;
												}
												
												if (typeof cachedProfiles[uid] === 'undefined') {
													req.call(activeUid, 'getProfiles', {'uids' : uid, 'fields' : 'first_name,last_name,sex,photo'}, function(res) {
														cachedProfiles[uid] = res[0];
														fn();
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
														'timeout' : 3,
														'onclick' : function() {
															this.cancel();
															chrome.tabs.create({'url' : 'http://' + Settings.Domain + '/id' + uid});
														}
													});
												};
												
												if (Settings.Status === 'no') { // настройки
													return;
												}
												
												if (typeof cachedProfiles[uid] === 'undefined') {
													req.call(activeUid, 'getProfiles', {'uids' : uid, 'fields' : 'first_name,last_name,sex,photo'}, function(res) {
														cachedProfiles[uid] = res[0];
														fn();
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
							}
							
							xhr = null;
						}
					};
					
					xhr.send();
				})();
			})
		});
	};
	
	// запускаем при загрузке
	chrome.browserAction.setBadgeBackgroundColor({'color' : [128, 128, 128, 128]});
	chrome.browserAction.setBadgeText({'text' : '...'});
	whoami(function(nickname) {
		gotUser(nickname);
	}, function() {
		chrome.browserAction.setBadgeBackgroundColor({'color' : [128, 128, 128, 128]})
		chrome.browserAction.setTitle({'title' : chrome.i18n.getMessage('notAuthorized')});
		chrome.browserAction.setBadgeText({'text' : 'X'});
		
		browserActionClickedAttach('guest');
	});
	
	
	chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
		switch (request.action) {
			case 'settingsChanged' :
				// обновляем настройки громкости оповещений
				var newVolume = Settings.SoundLevel;
				Object.keys(sounds).forEach(function(key) {
					sounds[key].volume = newVolume;
				});
				
				break;
			
			case 'state' :
				if (request.data === false) {
					activeAccount = [false, false];
					
					chrome.browserAction.setBadgeBackgroundColor({'color' : [128, 128, 128, 128]})
					chrome.browserAction.setTitle({'title' : chrome.i18n.getMessage('notAuthorized')});
					chrome.browserAction.setBadgeText({'text' : 'X'});
					
					browserActionClickedAttach('guest');
				} else {
					gotUser(request.data);
				}
				
				break;
			
			case 'auth_success' :
				tokens[request.uid] = request.token;
				localStorage.setItem('tokens', JSON.stringify(tokens));
				
				// закрываем окно OAuth
				chrome.windows.getAll({'populate' : true}, function(windows) {
					windows.forEach(function(windowElem) {
						windowElem.tabs.forEach(function(tab) {
							if (tab.url.indexOf('api.' + Settings.Domain + '/blank.html') !== -1) {
								chrome.tabs.remove(tab.id);
							}
						});
					});
				});
				
				chrome.browserAction.setBadgeText({'text' : ''});
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
							if (tab.url.indexOf('api.' + Settings.Domain + '/blank.html') !== -1) {
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
