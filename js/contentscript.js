(function(w) {
	var account = false;
	
	w.setInterval(function() {
		if (['vkontakte.ru', 'api.vkontakte.ru', 'vk.com', 'api.vk.com'].indexOf(w.location.host) === -1) {
			return;
		}
		
		if (w.location.host === 'api.vkontakte.ru' || w.location.host === 'api.vk.com') {
			if (w.location.href.indexOf('blank.html') !== -1 && w.location.href.indexOf('oauth/authorize') === -1) {
				var hash = w.location.hash.substr(1);
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
			if (document.querySelector('#quick_login_form') === null && document.querySelector('#quick_auth_frame') === null) {
				var myProfileLi = document.querySelector('#myprofile').innerHTML;
				var hrefMatch = myProfileLi.match(/href=".*?"/gm);
				var nickname = hrefMatch[1].substring(7, hrefMatch[1].length-1);
				
				if (nickname !== account) {
					account = nickname;
					chrome.extension.sendRequest({'action' : 'state', 'data' : nickname});
				}
			} else {
				if (account !== false) {
					account = false;
					chrome.extension.sendRequest({'action' : 'state', 'data' : false});
				}
			}
		}
	}, 1000);
})(window);
