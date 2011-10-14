window.setInterval(function() {
	if (['vkontakte.ru', 'api.vkontakte.ru', 'vk.com', 'api.vk.com'].indexOf(location.host) === -1) {
		return;
	}
	
	if (location.host === 'api.vkontakte.ru' || location.host === 'api.vk.com') {
		if (location.href.indexOf('blank.html') !== -1 && location.href.indexOf('oauth/authorize') === -1) {
			var hash = location.hash.substr(1);
			if (hash.indexOf('error') !== -1) {
				chrome.extension.sendRequest({'action' : 'auth_fail'});
			} else {
				var data = {'action' : 'auth_success'};
				
				hash.split('&').forEach(function(part) {
					if (part.indexOf('access_token') !== -1) {
						data.token = part.substr(13);
					}
					
					if (part.indexOf('user_id') !== -1) {
						data.uid = part.substr(8);
					}
				});
				
				chrome.extension.sendRequest(data);
			}
		}
	} else {
		if (document.body.innerHTML.indexOf('quick_login_form') === -1) {
			var myProfileLi = document.querySelector('#myprofile').innerHTML;
			var hrefMatch = myProfileLi.match(/href=".*?"/gm);
			var nickname = hrefMatch[1].substring(7, hrefMatch[1].length-1);
			
			chrome.extension.sendRequest({'action' : 'state', 'data' : nickname});
		} else {
			chrome.extension.sendRequest({'action' : 'state', 'data' : false});
		}
	}
}, 1000);
