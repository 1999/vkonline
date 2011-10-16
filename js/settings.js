var AppSettings = function() {
	var self = this,
		settings,
		settingsAvailable = {'Status' : 'no', 'Messages' : 'yes', 'SoundLevel' : 0.8, 'Domain' : 'vkontakte.ru'};
	
	var recalcSettings = function() {
		try {
			settings = JSON.parse(localStorage.getItem('settings') || '');
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
