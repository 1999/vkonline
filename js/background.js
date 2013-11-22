(function(w) {
	// запись custom-статистики
	function statSend(category, action, optLabel, optValue) {
		var args = [];

		for (var i = 0, len = Math.min(arguments.length, 4); i < len; i++) {
	        if (i === 3) {
	            if (typeof optValue === "boolean") {
	                optValue = Number(optValue);
	            } else if (typeof optValue !== "number") {
	                optValue = parseInt(optValue, 10) || 0;
	            }

	            args.push(optValue);
	        } else {
	            if (typeof arguments[i] !== "string") {
	                args.push(JSON.stringify(arguments[i]));
	            } else {
	                args.push(arguments[i]);
	            }
	        }
	    }

		try {
			window._gaq.push(["_trackEvent"].concat(args));
		} catch (e) {}
	};

	var LISTEN_CONTEST_URL = "http://vk.com/listenapp?w=wall-14300_27";

	chrome.storage.sync.get("listen_notification_shown", function (records) {
		if (records.listen_notification_shown)
			return;

		chrome.notifications && chrome.notifications.onClicked.addListener(function (notificationId) {
			chrome.notifications.clear(notificationId, function () {});
			chrome.tabs.create({'url': LISTEN_CONTEST_URL});

			statSend("Stat", "Actions", "Notification click", 1);
	    });

	    chrome.notifications && chrome.notifications.onButtonClicked.addListener(function (notificationId, buttonIndex) {
	    	chrome.notifications.clear(notificationId, function () {});

	    	if (buttonIndex === 0) {
	    		chrome.tabs.create({'url': LISTEN_CONTEST_URL});
	    		statSend("Stat", "Actions", "Yes button click", 1);
	    	} else {
	    		statSend("Stat", "Actions", "Yes button click", 0);
	    	}
	    });

		chrome.alarms.onAlarm.addListener(function (alarmInfo) {
			var now = new Date;
			var hours = now.getHours();
			var rightTime = false;

			if ([0, 6].indexOf(now.getDay()) !== -1) { // выходные
				rightTime = (hours >= 12 && hours < 22);
			} else { // будни
				rightTime = (hours >= 19 && hours < 23);
			}

			if (rightTime) {
				chrome.alarms.clear("listen_contest");

				var records = {};
				records.listen_notification_shown = true;
				chrome.storage.sync.set(records);

				chrome.notifications && chrome.notifications.create("listen_notification", {
					type: "basic",
					iconUrl: chrome.runtime.getURL("/pic/icon48.png"),
					title: "Конкурс от разработчика VK Online",
					message: "Участвуйте и выиграйте наушники Beats by Dre, колонки Jawbone и многое другое!",
					buttons: [
						{title: "Хочу участвовать"},
						{title: "Нет, спасибо"}
					]
				}, function () {});

				statSend("Stat", "Actions", "Show notification", 1);
			}
		});

		chrome.alarms.get("listen_contest", function (alarmInfo) {
			if (alarmInfo)
				return;

			chrome.alarms.create("listen_contest", {
				periodInMinutes: 5,
				when: Date.now()
			});
		});
	});

	/**
	 * [...] - запрос идет
	 * [?] - нет token, надо разрешить доступ, по клику открывается окно OAuth
	 * [X] - не авторизован ВКонтакте
	 */

	var Settings = new AppSettings();

	var VkAppId = 2642167,
		VkAppScope = ['messages', 'friends', 'offline'];

	var activeAccount = false;
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
			self = this,
			requestMethod, url;

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

		requestMethod = params.method || "POST";
		delete params.method;

		url = 'https://api.vk.com/method/' + method;
		if (requestMethod.toUpperCase() === "GET")
			url += "?" + serialize(params);

		var xhr = new XMLHttpRequest;
		xhr.open(requestMethod, url, true);

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
									localStorage.setItem('__badtoken__' + Date.now() + '__' + activeAccount, self);

									delete tokens[activeAccount];
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

		if (requestMethod.toUpperCase() === "POST") {
			var prop,
				qsa = [],
				formData = new FormData();

			Object.keys(params).forEach(function(key) {
				formData.append(key, params[key]);
			});

			xhr.send(formData);
		} else {
			xhr.send();
		}
	};

	var whoami = function(fnUser, fnGuest) {
		var args = arguments;

		var xhr = new XMLHttpRequest();
		xhr.responseType = "document";
		xhr.open('GET', 'http://vk.com/', true);

		xhr.addEventListener("load", function() {
			chrome.browserAction.setIcon({'path' : chrome.extension.getURL('pic/icon19.png')});
			chrome.browserAction.setBadgeText({'text' : ''});

			if (xhr.response.querySelector("title").textContent.length <= 7) { // беда с кодировкой ВКонтакте, поэтому легче проверить на длину строки
				var nickname = xhr.response.querySelector("#myprofile").getAttribute("href").substr(1);
				fnUser(nickname);
			} else {
				fnGuest();
			}
		}, false);

		xhr.addEventListener("error", function() {
			chrome.browserAction.setIcon({'path' : chrome.extension.getURL('pic/icon19_offline.png')});
			chrome.browserAction.setBadgeText({'text' : ''});

			w.setTimeout(function() {
				whoami.apply(w, args);
			}, 1000);
		}, false);

		xhr.send();
	};

	var gotUser = function(nickname) {
		var fn = function(userId) {
			if (typeof tokens[userId] === 'undefined') { // еще нет доступа
				chrome.browserAction.setBadgeBackgroundColor({'color' : [128, 128, 128, 128]});
				chrome.browserAction.setTitle({'title' : chrome.i18n.getMessage('notGranted')});
				chrome.browserAction.setBadgeText({'text' : '?'});

				browserActionClickedAttach('newbie');
				activeAccount = false;
			} else {
				if (activeAccount !== userId) { // смена пользователя или просто его установка из состояния false
					if (localStorage.getItem('offline_enabled_' + userId) === null) { // приложение обновилось, но возможна ошибка инвалидации token (до версии 2.0.1)
						chrome.browserAction.setBadgeBackgroundColor({'color' : [128, 128, 128, 128]});
						chrome.browserAction.setTitle({'title' : chrome.i18n.getMessage('notGranted')});
						chrome.browserAction.setBadgeText({'text' : '?'});

						browserActionClickedAttach('newbie');
						activeAccount = false;

						// уведомление о необходимости увеличения прав приложения ВКонтакте
						showNotification.call(w, {
							'message' : chrome.i18n.getMessage('accessOfflineNeeded'),
							'onclick' : function() {
								this.cancel();

								chrome.windows.getAll(null, function(windows) {
									var oauthUrl = 'http://api.vk.com/oauth/authorize?client_id=' + VkAppId + '&scope=' + VkAppScope.join(',') + '&redirect_uri=http://api.vk.com/blank.html&display=page&response_type=token';

									if (windows.length) {
										chrome.tabs.create({'url' : oauthUrl});
									} else {
										chrome.windows.create({'url' : oauthUrl});
									}
								});
							}
						});
					} else {
						chrome.browserAction.setBadgeBackgroundColor({'color' : [255, 0, 0, 128]});
						chrome.browserAction.setTitle({'title' : chrome.i18n.getMessage('extName')});
						chrome.browserAction.setBadgeText({'text' : ''});

						browserActionClickedAttach('granted');
						activeAccount = userId;

						startUserSession();
					}
				}
			}
		};

		if (/^id[0-9]+$/.test(nickname)) {
			fn(nickname.substr(2));
		} else {
			// получаем UID
			req.call(w, 'utils.resolveScreenName', {method: 'GET', screen_name: nickname}, function(res) {
				fn(res.object_id.toString());
			});
		}
	};

	/**
	 * Функции-обработчики нажатия на browser action icon
	 */
	var browserActionClickedFn = {
		'guest' : function() {
			chrome.tabs.create({'url' : 'http://vk.com'});
		},
		'granted' : function() {
			if (Settings.OpenNotification === 'new') {
				chrome.tabs.create({'url' : 'http://vk.com/im'});
			} else {
				chrome.tabs.create({'url' : 'http://vk.com/mail'});
			}
		},
		'newbie' : function() {
			chrome.tabs.create({'url' : 'http://api.vk.com/oauth/authorize?client_id=' + VkAppId + '&scope=' + VkAppScope.join(',') + '&redirect_uri=http://api.vk.com/blank.html&display=page&response_type=token'});
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
		var activeToken = tokens[activeAccount],
			activeUid = activeAccount;

		req.call(activeToken, 'messages.getLongPollServer', function(longPollRes) {
			if (activeUid !== activeAccount) { // проверка на смену пользователя
				return;
			}

			req.call(activeToken, 'messages.get', {'filters' : 1, 'count' : 1}, function(res) {
				var totalNew = (res instanceof Array) ? res[0] : 0;
				if (activeUid !== activeAccount) { // проверка на смену пользователя
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
						url = 'http://' + longPollRes.server + '?act=a_check&key=' + longPollRes.key + '&ts=' + longPollRes.ts + '&wait=25&mode=0';

					xhr.open('GET', url, true);
					xhr.onreadystatechange = function() {
						if (xhr.readyState === 4) {
							if (activeUid !== activeAccount) { // проверка на смену пользователя
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
									var updateCounterOnRead = function(totalNew) {
										if (totalNew) {
											chrome.browserAction.setBadgeText({'text' : totalNew.toString()});
										} else {
											chrome.browserAction.setBadgeText({'text' : ''});
										}
									};

									result.updates.forEach(function(data) {
										switch (data[0]) {
											case 2 : // mark as new
												totalNew += 1;
												chrome.browserAction.setBadgeText({'text' : totalNew.toString()});

												sounds.message.play();
												break;

											case 3 : // mark as read
												req.call(activeToken, 'messages.getById', {'mid' : data[1]}, function(res) {
													if (res instanceof Array && res.length === 2) {
														if (res[1].out === 0) {
															totalNew -= 1;
															updateCounterOnRead(totalNew);
														}
													} else {
														totalNew -= 1;
														updateCounterOnRead(totalNew);
													}
												}, function() {
													totalNew -= 1;
													updateCounterOnRead(totalNew);
												});

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

																	if (Settings.OpenNotification === 'new') {
																		chrome.tabs.create({'url' : 'http://vk.com/im?sel=' + uid});
																	} else {
																		chrome.tabs.create({'url' : 'http://vk.com/mail?act=show&id=' + data[1]});
																	}
																}
															};

															if (playSound) {
																notificationData.sound = 'message';
															}

															showNotification.call(cachedProfiles[uid], notificationData);
														};

														if (typeof cachedProfiles[uid] === 'undefined') {
															req.call(activeToken, 'getProfiles', {'uids' : uid, 'fields' : 'first_name,last_name,sex,photo'}, function(res) {
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
														'timeout' : 5,
														'sound' : 'status',
														'onclick' : function() {
															this.cancel();
															chrome.tabs.create({'url' : 'http://vk.com/id' + uid});
														}
													});
												};

												if (Settings.Status === 'no') { // настройки
													return;
												}

												if (Settings.LookFor.indexOf(uid) === -1) { // за этим не следим
													return;
												}

												if (typeof cachedProfiles[uid] === 'undefined') {
													req.call(activeToken, 'getProfiles', {'uids' : uid, 'fields' : 'first_name,last_name,sex,photo'}, function(res) {
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
														'timeout' : 5,
														'onclick' : function() {
															this.cancel();
															chrome.tabs.create({'url' : 'http://vk.com/id' + uid});
														}
													});
												};

												if (Settings.Status === 'no') { // настройки
													return;
												}

												if (Settings.LookFor.indexOf(uid) === -1) { // за этим не следим
													return;
												}

												if (typeof cachedProfiles[uid] === 'undefined') {
													req.call(activeToken, 'getProfiles', {'uids' : uid, 'fields' : 'first_name,last_name,sex,photo'}, function(res) {
														cachedProfiles[uid] = res[0];
														fn();
													});
												} else {
													fn();
												}

												break;
										}
									});

									if (activeUid !== activeAccount) { // проверка на смену пользователя
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
	whoami(gotUser, function() {
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
					activeAccount = false;

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
							if (tab.url.indexOf('api.vk.com/blank.html') !== -1) {
								chrome.tabs.remove(tab.id);
							}
						});
					});
				});

				localStorage.setItem('offline_enabled_' + request.uid, 1);
				gotUser('id' + request.uid);

				break;

			case 'auth_fail' :
				// закрываем окно OAuth
				chrome.windows.getAll({'populate' : true}, function(windows) {
					windows.forEach(function(windowElem) {
						windowElem.tabs.forEach(function(tab) {
							if (tab.url.indexOf('api.vk.com/blank.html') !== -1) {
								chrome.tabs.remove(tab.id);
							}
						});
					});
				});

				break;

			case 'getActiveUserToken' :
				if (activeAccount === false) {
					sendResponse(false);
				} else {
					sendResponse(tokens[activeAccount]);
				}

				break;
		}
	});


	w.onerror = function(msg, url, line) {
		alert(msg + ' (line: ' + line + ')');
	};
})(window);
