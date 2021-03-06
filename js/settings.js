var AppSettings = function() {
	var self = this,
		settings,
		settingsAvailable = {'Status' : 'no', 'Messages' : 'yes', 'SoundLevel' : 0.8, 'OpenNotification' : 'new', 'LookFor' : '[]'};
	
	var recalcSettings = function() {
		try {
			var key;
			
			settings = JSON.parse(localStorage.getItem('settings') || '');
			for (key in settingsAvailable) {
				if (settingsAvailable.hasOwnProperty(key) && typeof settings[key] === 'undefined') {
					settings[key] = settingsAvailable[key];
				}
			}
		} catch (e) {
			settings = settingsAvailable;
		}
	};
	
	// устанавливаем настройки при инициализации
	recalcSettings();
	
	// устанавливаем геттеры и сеттеры
	Object.keys(settingsAvailable).forEach(function(key) {
		self.__defineGetter__(key, function() {
			// заново получаем на случай, если они изменились за это время
			recalcSettings();
			
			return (typeof settings[key] !== 'undefined')
				? settings[key]
				: null;
		});
		
		self.__defineSetter__(key, function(value) {
			settings[key] = value;
			localStorage.setItem('settings', JSON.stringify(settings));
		});
	});
};
