chrome.browserAction.onClicked.addListener(function(tab) {
	chrome.tabs.create({
		'url' : 'http://vk.com/im'
	});
});

var i = 0;
chrome.browserAction.setBadgeBackgroundColor({'color' : [255, 128, 0, 255]})

window.setInterval(function() {
	chrome.browserAction.setBadgeText({'text' : i.toString()});
	i += 1;
}, 1000);

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
	
	window.onbeforeunload = function() { // сброс blob-данных при обновлении версии приложения
		Object.keys(cacheAvatars).forEach(function(uid) {
			(window.URL || window.webkitURL).revokeObjectURL(cacheAvatars[uid]);
			Console.log('Blob avatar for user #' + uid + ' cleared');
		});
	};
	
	
	var dbFailFn = function(msg) {
		Console.warn(msg);
		Console.trace();
	};
	
	var fsFailFn = function(err) {
		Console.warn(err.message);
		Console.trace();
	};
	
	var fetchPhoto = function(photoUrl, fn, fnProgress) {
		var xhr = new XMLHttpRequest();
		xhr.overrideMimeType('text/plain; charset=x-user-defined');
		xhr.open('GET', photoUrl, true);
		
		if (typeof fnProgress === 'function') {
			xhr.onprogress = fnProgress;
		}
		
		xhr.onreadystatechange = function() {
			if (xhr.readyState === 4 && xhr.status === 200) {
				var contentType = xhr.getResponseHeader('Content-type'),
					BlobBuilderObj, blob,
					i, byteArray = new Uint8Array(xhr.responseText.length);
				
				for (i=0; i<xhr.responseText.length; i++) {
					byteArray[i] = xhr.responseText.charCodeAt(i) & 0xff;
				}
				
				BlobBuilderObj = new (window.BlobBuilder || window.WebKitBlobBuilder)();
				BlobBuilderObj.append(byteArray.buffer);
				blob = BlobBuilderObj.getBlob(contentType.split(";")[0]);
				
				fn(blob);
				xhr = null;
			}
		};
		
		xhr.send();
	};
	
	var _avatarExistsCallbacks = {};
	var avatarExists = function(contactObj, callbackSuccess, callbackFail) {
		if (typeof cacheAvatars[contactObj.uid] !== 'undefined') {
			callbackSuccess(cacheAvatars[contactObj.uid]);
			return;
		}
		
		if (typeof _avatarExistsCallbacks[contactObj.uid] === 'undefined' || _avatarExistsCallbacks[contactObj.uid].length === 0) {
			_avatarExistsCallbacks[contactObj.uid] = [[callbackSuccess, callbackFail]];
		} else {
			_avatarExistsCallbacks[contactObj.uid].push([callbackSuccess, callbackFail]);
		}
		
		if (_avatarExistsCallbacks[contactObj.uid].length > 1) { // не допускаем более, чем 1 запроса
			return;
		}
		
		var afterFn = function(res) {
			var self = this;
			Console.log('Got avatar for user #' + contactObj.uid + ': ' + cacheAvatars[contactObj.uid] + '. Number of waiting callbacks: ' + _avatarExistsCallbacks[contactObj.uid].length);
			
			_avatarExistsCallbacks[contactObj.uid].forEach(function(fn) {
				if (res) {
					fn[0](cacheAvatars[contactObj.uid]);
				} else {
					fn[1](self);
				}
			});
			
			_avatarExistsCallbacks[contactObj.uid] = [];
		};
		
		if (fsLink === null) {
			Console.log('Fetching avatar for user #' + contactObj.uid);
			var photoUrl = JSON.parse(contactObj.other_data).photo;
			
			fetchPhoto(photoUrl, function(blob) {
				cacheAvatars[contactObj.uid] = (window.URL || window.webkitURL).createObjectURL(blob);
				afterFn(true);
			});
		} else {
			Console.log('Requesting avatar for user #' + contactObj.uid + ' from FS...');
			
			fsLink.root.getFile(contactObj.uid + '_th.jpg', {'create' : false}, function(fileEntry) {
				fileEntry.file(function(theFile) {
					cacheAvatars[contactObj.uid] = (window.URL || window.webkitURL).createObjectURL(theFile);
					afterFn(true);
				}, function(err) {
					afterFn.call(err, false);
				});
			}, function(err) {
				afterFn.call(err, false);
			});
		}
	};
	
	var fileExists = function(fileName, getFileOnly, callbackSuccess, callbackFail) {
		if (typeof getFileOnly === 'function') {
			callbackFail = callbackSuccess;
			callbackSuccess = getFileOnly;
			getFileOnly = false;
		}
		
		var matches = fileName.match(/([0-9]+)_th/);
		if (matches !== null && typeof cacheAvatars[matches[1]] !== 'undefined' && getFileOnly === false) {
			callbackSuccess(true);
		} else {
			if (fsLink === null) {
				callbackFail(fileName);
			} else {
				fsLink.root.getFile(fileName, {'create' : false}, function(fileEntry) {
					fileEntry.file(callbackSuccess, function(fileError) {
						Console.warn(fileError);
					});
				}, function(fileError) {
					if (fileError.code === FileError.NOT_FOUND_ERR) {
						callbackFail(fileName);
					} else {
						Console.warn(fileError);
					}
				});
			}
		}
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
	
	var req = function(method, params, fnOk, fnFail) {
		if (typeof params === 'function') {
			fnFail = fnOk;
			fnOk = params;
			params = {};
		}
		
		params = params || {};
		params.access_token = this[0];
		
		var prop, qsa = [], formData = new FormData();
		for (prop in params) {
			if (params.hasOwnProperty(prop)) {
				formData.append(prop, params[prop]);
			}
		}
		
		var xhr = new XMLHttpRequest();
		xhr.open('POST', 'https://api.vk.com/method/' + method, true);
		
		xhr.onreadystatechange = function() {
			if (xhr.readyState === 4) {
				if (xhr.status === 0) {
					if (typeof fnFail === 'function') {
						fnFail('Can\'t connect to VK API. Maybe internet connection problems?');
						xhr = null;
					}
					
					// уведомление о работе сети
					chrome.extension.sendRequest({'action' : 'networkDown'});
					
					//Console.trace();
					return;
				}
				
				// уведомление о работе сети
				chrome.extension.sendRequest({'action' : 'networkUp'});
				
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
		Console.log([Date.now(), method, params]);
	};
	
	var _getOnePerson = function(uid, fn, fnInsertFail, fnReqFail) {
		var profile = this;
		
		req.call(profile, 'getProfiles', {'uids' : uid, 'fields' : 'first_name,last_name,domain,bdate,photo,contacts'}, function(res) {
			Dbs[profile[1]].insertContact(uid, res[0].first_name, res[0].last_name, JSON.stringify(res[0]), '', function(localId) {
				Console.log('User #' + uid + ' inserted as ' + localId);
				
				cache[profile[1]].contacts[uid] = {
					'uid' : uid,
					'first_name' : res[0].first_name,
					'last_name' : res[0].last_name,
					'other_data' : JSON.stringify(res[0]),
					'old_names' : '',
					'notes' : ''
				};
				
				var cacheData = {};
				cacheData[uid] = cache[profile[1]].contacts[uid];
				chrome.extension.sendRequest({'action' : 'updateCache', 'data' : cacheData, 'type' : 'contacts', 'ap' : profile[1]});
				
				fn();
			}, fnInsertFail);
			
			if (fsLink !== null) {
				fetchPhoto(res[0].photo, function(blob) {
					fsLink.root.getFile(uid + '_th.jpg', {'create' : true, 'exclusive' : false}, function(fileEntry) {
						fileEntry.createWriter(function(fileWriter) {
							fileWriter.write(blob);
						}, fsFailFn);
					}, fsFailFn);
				});
			}
		}, fnReqFail);
	};
	
	var friendsSyncProcess = function() {
		var profile = profileStack.last();
		chrome.extension.sendRequest({'action' : 'finishedContactsSync'});
		
		req.call(profile, 'friends.get', function(res) {
			if (res.constructor !== Array) {
				Console.error(res);
				window.setTimeout(friendsSyncProcess, 5000);
				return;
			}
			
			(function(uid) {
				var callee = arguments.callee;
				
				var next = function(timeout) {
					if (typeof timeout === 'undefined') {
						timeout = 350;
					}
					
					if (res.length) {
						if (profileStack.last()[1] !== profile[1]) {
							chrome.extension.sendRequest({'action' : 'finishingContactsSync', 'profile' : profile});
						}
						
						window.setTimeout(function() {
							callee(res.shift())
						}, timeout);
					} else {
						window.setTimeout(friendsSyncProcess, 5000);
					}
				};
				
				if (typeof cache[profile[1]].contacts[uid] === 'undefined') {
					_getOnePerson.call(profile, uid, next, dbFailFn, function(err) {
						Console.error(err);
						
						res.push(uid);
						next();
					});
				} else {
					next(0);
				}
			})(res.shift());
		}, function(err) {
			Console.error(err);
			window.setTimeout(friendsSyncProcess, 5000);
		});
	};
	
	var mailSyncProcess = function(syncType) {
		chrome.extension.sendRequest({'action' : 'finishedMailSync', 'type' : syncType});
		Console.log('mail sync process');
		
		var profile = profileStack.last(),
			reqData,
			permStateInbox = localStorage.getItem('perm_inbox_' + profile[1]),
			permStateOutbox = localStorage.getItem('perm_outbox_' + profile[1]),
			syncType = (permStateInbox === null) ? 'inbox' : 'outbox';
		
		if (permStateInbox !== null && permStateOutbox !== null) {
			reqLongPoll();
			return;
		}
		
		var reqFailFn = function(err) {
			Console.warn(err);
			window.setTimeout(mailSyncProcess, 350);
		};
		
		var intervalsState = localStorage.getItem('intervals_' + syncType + '_' + profile[1]);
		if (intervalsState === null) { // первый вызов
			reqData = {'offset' : 0, 'count' : 1};
			if (syncType === 'outbox') {
				reqData.out = 1;
			}
			
			req.call(profile, 'messages.get', reqData, function(res) {
				var totalIntervals = Math.ceil(res[0] / 100), i, intervals = [];
				for (i=0; i<totalIntervals; i++) {
					intervals.push(i);
				}
				
				localStorage.setItem('intervals_' + syncType + '_' + profile[1], JSON.stringify(intervals));
				localStorage.setItem('livetotal_' + syncType + '_' + profile[1], '[]');
				
				window.setTimeout(mailSyncProcess, 350);
			}, reqFailFn);
		} else {
			intervalsState = JSON.parse(intervalsState);
			var liveTotals = JSON.parse(localStorage.getItem('livetotal_' + syncType + '_' + profile[1]));
			
			reqData = {'offset' : intervalsState[0]*100, 'count' : 100, 'preview_length' : 0};
			if (syncType === 'outbox') {
				reqData.out = 1;
			}
			
			req.call(profile, 'messages.get', reqData, function(res) {
				if (res === 0) {
					reqFailFn(res);
					return;
				}
				
				var totalNow = res.shift(); // убираем количество сообщений
				liveTotals.push(totalNow);
				localStorage.setItem('livetotal_' + syncType + '_' + profile[1], JSON.stringify(liveTotals));
				
				/*
				 * за время синхронизации могут появиться новые сообщения
				 * поэтому на каждой итерации смещаем массив сообщений
				 */
				if (liveTotals.length > 1) {
					var diffTotal = totalNow - liveTotals[liveTotals.length - 2];
					if (diffTotal > 0) {
						res = res.slice(diffTotal);
					}
				}
				
				(function(msg) {
					var callee = arguments.callee;
					
					if (profileStack.last()[1] !== profile[1]) {
						chrome.extension.sendRequest({'action' : 'finishingMailSync', 'profile' : profile});
					}
					
					var next = function(nextItem) {
						nextItem = nextItem || true;
						if (nextItem === false) {
							callee(msg);
							return;
						}
						
						// обновляем счетчик temp_[synctype]_uid сообщений
						if (res.length) {
							callee(res.shift());
						} else {
							intervalsState = intervalsState.slice(1);
							
							if (intervalsState.length) {
								localStorage.setItem('intervals_' + syncType + '_' + profile[1], JSON.stringify(intervalsState));
							} else {
								localStorage.removeItem('intervals_' + syncType + '_' + profile[1]);
								localStorage.removeItem('livetotal_' + syncType + '_' + profile[1]);
								localStorage.setItem('perm_' + syncType + '_' + profile[1], 1);
								
								Console.log('[' + syncType + '] synced');
							}
							
							window.setTimeout(mailSyncProcess, 350);
						}
					};
					
					if (msg.uid < 0) { // письмо с почты
						Console.warn('Message #' + msg.mid + ' from email. Skip');
						
						next();
						return;
					}
					
					if (typeof cache[profile[1]][syncType][msg.mid] !== 'undefined') { // если такое сообщение уже есть
						localStorage.removeItem('intervals_' + syncType + '_' + profile[1]);
						localStorage.removeItem('livetotal_' + syncType + '_' + profile[1]);
						localStorage.setItem('perm_' + syncType + '_' + profile[1], 1);
						
						Console.log('[' + syncType + '] synced');
						window.setTimeout(mailSyncProcess, 350);
						return;
					}
					
					var insertMsg = function() {
						var attachmentsInfo = (typeof msg.attachments === 'undefined') ? {} : msg.attachments;
						Dbs[profile[1]]['insert' + syncType.charAt(0).toUpperCase() + syncType.substr(1) + 'Message'](msg.mid, msg.uid, msg.date, msg.title, msg.body, '', msg.read_state, attachmentsInfo, function(localId) {
							Console.log('[' + syncType + '] Message #' + msg.mid + ' inserted as ' + localId);
							cache[profile[1]][syncType][msg.mid] = msg;
							
							// уведомление
							if (syncType === 'inbox' && msg.read_state === 0) {
								showNotification.call(profile, msg.mid);
							}
							
							var cacheData = {};
							cacheData[msg.mid] = msg;
							chrome.extension.sendRequest({'action' : 'updateCache', 'data' : cacheData, 'type' : syncType, 'ap' : profile[1]});
							
							next();
						}, function(err) {
							Console.warn(err);
							
							// заново
							next(false);
						});
					};
					
					if (typeof cache[profile[1]].contacts[msg.uid] === 'undefined') {
						_getOnePerson.call(profile, msg.uid, insertMsg, insertMsg, function(err) { // ошибка при запросе к API
							Console.warn(err);
							
							// заново
							next(false);
						});
					} else {
						insertMsg();
					}
				})(res.shift());
			}, reqFailFn);
		}
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
	
	
	var startUserSession = function() {
		var index = 0, token = JSON.parse(localStorage.getItem('token'));
		if (typeof token[0] === 'string') {
			token = [token];
		}
		
		if (token.length > 1) {
			var i, activeProfile = localStorage.getItem('profile_act');
			for (i=0; i<token.length; i++) {
				if (parseInt(token[i][1], 10) === parseInt(activeProfile, 10)) {
					index = i;
					break;
				}
			}
		}

		profileStack.push(token[index]);
		
		// указываем активного пользователя
		chrome.extension.sendRequest({'action' : 'setActiveUser', 'uid' : token[index][1]});
		
		var startSyncProcess = (Object.keys(Dbs).length === 0);
		if (typeof Dbs[token[index][1]] === 'undefined') {
			// пользовательский кэш
			cache[token[index][1]] = {
				'contacts' : {},
				'inbox' : {},
				'outbox' : {}
			};
			
			// объект БД для пользователя
			Dbs[token[index][1]] = new AppDatabase(dbLink);
			
			Dbs[token[index][1]].initUser(token[index][1], function() {
				Dbs[token[index][1]].getContactList(function(userList) {
					cache[token[index][1]].contacts = userList;
					chrome.extension.sendRequest({'action' : 'updateCache', 'data' : cache[token[index][1]].contacts, 'type' : 'contacts', 'init' : 1, 'ap' : token[index][1]});
				}, dbFailFn);
				
				Dbs[token[index][1]].getInbox(function(inboxList) {
					cache[token[index][1]].inbox = inboxList;
					chrome.extension.sendRequest({'action' : 'updateCache', 'data' : cache[token[index][1]].inbox, 'type' : 'inbox', 'init' : 1, 'ap' : token[index][1]});
				}, dbFailFn);
				
				Dbs[token[index][1]].getOutbox(function(outboxList) {
					cache[token[index][1]].outbox = outboxList;
					chrome.extension.sendRequest({'action' : 'updateCache', 'data' : cache[token[index][1]].outbox, 'type' : 'outbox', 'init' : 1, 'ap' : token[index][1]});
				}, dbFailFn);
			});
		} else {
			// инциализация объекта БД уже была проведена, значит синхронизация уже была начата
			chrome.extension.sendRequest({'action' : 'updateCache', 'data' : cache[token[index][1]].contacts, 'type' : 'contacts', 'init' : 1, 'ap' : token[index][1]});
			chrome.extension.sendRequest({'action' : 'updateCache', 'data' : cache[token[index][1]].inbox, 'type' : 'inbox', 'init' : 1, 'ap' : token[index][1]});
			chrome.extension.sendRequest({'action' : 'updateCache', 'data' : cache[token[index][1]].outbox, 'type' : 'outbox', 'init' : 1, 'ap' : token[index][1]});
		}
		
		if (startSyncProcess) {
			friendsSyncProcess();					
			mailSyncProcess();
		}
		
		
		// получение аватарки профиля и его ФИО
		if (token[index][2] === '' || typeof token[index][3] === 'undefined') {
			req.call(token[index], 'getProfiles', {'uids' : token[index][1], 'fields' : 'first_name,last_name,photo'}, function(res) {
				if (token[index][2] === '') {
					var userName = res[0].first_name + ' ' + res[0].last_name;
					token[index][2] = userName;
					localStorage.setItem('token', JSON.stringify(token));
					
					chrome.extension.sendRequest({'action' : 'gotName', 'uid' : token[index][1], 'name' : userName});
				}
				
				if (typeof token[index][3] === 'undefined') {
					fetchPhoto(res[0].photo, function(blob) {
						token[index][3] = res[0].photo;
						localStorage.setItem('token', JSON.stringify(token));
						
						cacheAvatars[token[index][1]] = (window.URL || window.webkitURL).createObjectURL(blob);
						chrome.extension.sendRequest({'action' : 'gotAvatar', 'uid' : token[index][1], 'url' : cacheAvatars[token[index][1]]});
						
						if (fsLink !== null) {
							fsLink.root.getFile(token[index][1] + '_th.jpg', {'create' : true, 'exclusive' : false}, function(fileEntry) {
								fileEntry.createWriter(function(fileWriter) {
									fileWriter.write(blob);
								}, fsFailFn);
							}, fsFailFn);
						}
					});
				}
			});
		} else {
			if (fsLink === null) {
				if (typeof cacheAvatars[token[index][1]] === 'undefined') {
					fetchPhoto(token[index][3], function(blob) {
						cacheAvatars[token[index][1]] = (window.URL || window.webkitURL).createObjectURL(blob);
						chrome.extension.sendRequest({'action' : 'gotAvatar', 'uid' : token[index][1], 'url' : cacheAvatars[token[index][1]]});
					});
				} else {
					chrome.extension.sendRequest({'action' : 'gotAvatar', 'uid' : token[index][1], 'url' : cacheAvatars[token[index][1]]});
				}
			} else {
				fsLink.root.getFile(token[index][1] + '_th.jpg', {'create' : false}, function(fileEntry) {
					fileEntry.file(function(theFile) {
						cacheAvatars[token[index][1]] = (window.URL || window.webkitURL).createObjectURL(theFile);
						chrome.extension.sendRequest({'action' : 'gotAvatar', 'uid' : token[index][1], 'url' : cacheAvatars[token[index][1]]});
					}, fsFailFn);
				}, fsFailFn);
			}
		}
	};
	
	
	chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
		switch (request.action) {
			case 'profileChanged' :
				localStorage.setItem('profile_act', request.uid);
				startUserSession();
				break;
			
			case 'settingsChanged' :
				Console.renewState();
				
				// обновляем настройки громкости оповещений
				var newVolume = Settings.SoundLevel;
				Object.keys(sounds).forEach(function(key) {
					sounds[key].volume = newVolume;
				});
				
				break;
			
			case 'whatcanido' :
				startUserSession();
				
				try {
					var appDetails = chrome.app.getDetails();
					if (appDetails !== null) {
						chrome.extension.sendRequest({'action' : 'appDetails', 'data' : appDetails.version});
					}
				} catch (e) {
					// do nothing
				}
				
				break;
				
			case 'avatar' :
				var profile = profileStack.last();
				avatarExists(cache[profile[1]].contacts[request.uid], sendResponse, function() {
					sendResponse(null);
				});
				
				break;
			
			case 'doc' :
				var profile = profileStack.last();
				req.call(profile, 'docs.getById', {'docs' : request.owner_id + '_' + request.doc_id}, function(res) {
					var param = (res.constructor === Object) ? {} : res[0];
					sendResponse(param);
				}, sendResponse);
				
				break;
			
			case 'audio' :
				var profile = profileStack.last();
				req.call(profile, 'audio.getById', {'audios' : request.owner_id + '_' + request.audio_id}, function(res) {
					sendResponse(res[0]);
				}, sendResponse);
				
				break;
			
			case 'photo' :
				var profile = profileStack.last();
				req.call(profile, 'photos.getById', {'photos' : request.owner_id + '_' + request.photo_id}, function(res) {
					sendResponse(res[0]);
				}, sendResponse);
				
				break;
			
			case 'video' :
				var profile = profileStack.last();
				req.call(profile, 'video.get', {'videos' : request.owner_id + '_' + request.video_id}, function(res) {
					sendResponse(res[1]);
				}, sendResponse);
				
				break;
			
			case 'markAsRead' :
				var profile = profileStack.last();
				Dbs[profile[1]].markMessageRead(request.mid, function() {
					// nothing
				}, dbFailFn);
				
				req.call(profile, 'messages.markAsRead', {'mids' : request.mid});
				cache[profile[1]].inbox[request.mid].read_state = 1;
				
				break;
			
			case 'messagesNum' :
				var profile = profileStack.last();
				Dbs[profile[1]].getCorrespondenceNum(request.uid, sendResponse);
				break;
			
			case 'correspondenceAll' :
				var profile = profileStack.last();
				Dbs[profile[1]].getCorrespondence(request.uid, sendResponse, dbFailFn);
				break;
			
			case 'sendMessage' :
				var profile = profileStack.last();
				request.subject = request.subject || chrome.i18n.getMessage('appName') + ' message';
				
				req.call(profile, 'messages.send', {'uid' : request.to, 'title' : request.subject, 'message' : request.body}, function(res) {
					// play sound
					sounds.sent.play();
					
					sendResponse([null, res]);
				}, function(err) {
					// play sound
					sounds.error.play();
					
					sendResponse([err]);
				});
				
				break;
			
			case 'deleteMessage' :
				var profile = profileStack.last();
				var fnCalled = 0, fn = function() {
					fnCalled += 1;
					
					if (fnCalled == 2) {
						delete cache[profile[1]][request.type][request.mid];
						
						// play sound
						sounds.clear.play();
						
						// посылаем уведомление об изменении количества писем
						var cacheData = {};
						cacheData[request.mid] = null;
						chrome.extension.sendRequest({'action' : 'updateCache', 'data' : cacheData, 'type' : request.type, 'ap' : profile[1]})
						
						sendResponse();
					}
				};
				
				Dbs[profile[1]].deleteMessage(request.mid, function(rowsAffected) {
					fn();
				}, dbFailFn);
				
				req.call(profile, 'messages.delete', {'mid' : request.mid}, function(res) {
					fn();
				});
				
				break;
				
			case 'auth_success' :
				var existingToken = localStorage.getItem('token'), i, existingUserFound = false;
				if (existingToken !== null) {
					existingToken = JSON.parse(existingToken);
					if (typeof existingToken[0] === 'string') {
						existingToken = [existingToken];
					}
					
					for (i=0; i<existingToken.length; i++) {
						if (parseInt(request.uid, 10) === parseInt(existingToken[i][1], 10)) {
							existingToken[i][0] = request.token; // обновляем token
							localStorage.setItem('token', JSON.stringify(existingToken));
							
							existingUserFound = true;
							break;
						}
					}
					
					if (existingUserFound === false) { // добавлен новый профиль
						var addedProfile = [request.token, request.uid, ''];
						existingToken.push(addedProfile);
						localStorage.setItem('token', JSON.stringify(existingToken));
						
						// активным является новый профиль
						localStorage.setItem('profile_act', request.uid);
						
						// запрашиваем перерисовку фронта
						chrome.extension.sendRequest({'action' : 'requestRedraw'});
					} else {
						// указываем активного пользователя, чтобы вернуть фокус option
						chrome.extension.sendRequest({'action' : 'setActiveUser', 'uid' : request.uid});
					}
				} else {
					localStorage.setItem('token', JSON.stringify([request.token, request.uid, '']));
				}
				
				// закрываем окно OAuth
				var foundAppTab = false;
				chrome.windows.getAll({'populate' : true}, function(windows) {
					windows.forEach(function(windowElem) {
						windowElem.tabs.forEach(function(tab) {
							if (tab.url.indexOf('api.vk.com/blank.html') !== -1) {
								chrome.tabs.remove(tab.id);
							} else {
								if (tab.url === chrome.extension.getURL('main.html')) {
									chrome.windows.update(windowElem.id, {'focused' : true});
									chrome.tabs.update(tab.id, {'selected' : true});
									
									foundAppTab = true;
								}
							}
						});
					});
				});
				
				// открываем окно приложения
				if (foundAppTab === false) {
					chrome.tabs.create({
						'url' : chrome.extension.getURL('main.html')
					});
				}
				
				// запускаем синхронизацию (заново)
				if (existingUserFound === false) { // не перезапускаем процесс обновленном token пользователя
					startUserSession();
				}
				
				break;
			
			case 'auth_fail' :
				var foundAppTab = false;
				chrome.windows.getAll({'populate' : true}, function(windows) {
					windows.forEach(function(windowElem) {
						windowElem.tabs.forEach(function(tab) {
							if (tab.url.indexOf('api.vkontakte.ru/blank.html') !== -1 || tab.url.indexOf('api.vk.com/blank.html') !== -1) {
								chrome.tabs.remove(tab.id);
							} else {
								if (tab.url === chrome.extension.getURL('main.html')) {
									chrome.windows.update(windowElem.id, {'focused' : true});
									chrome.tabs.update(tab.id, {'selected' : true});
									
									foundAppTab = true;
								}
							}
						});
					});
				});
				
				// открываем окно приложения
				if (foundAppTab === false) {
					chrome.tabs.create({
						'url' : chrome.extension.getURL('main.html')
					});
				}
				
				break;
		}
	});
	
	// поехали что ли
	var token = localStorage.getItem('token');
	if (token === null) {
		
	} else {
		startUserSession();
	}
});
