if (location.href.indexOf('blank.html') !== -1 && location.href.indexOf('oauth/authorize') === -1) {
	var hash = location.hash.substr(1);
	if (hash.indexOf('error') !== -1) {
		chrome.extension.sendRequest({
			'action' : 'auth_fail'
		});
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
