var AppSettings = function() {
	var settingsAvailable = ['Debug', 'SortContacts', 'DeleteUser', 'SoundLevel'],
		settings, self = this;
	
	var recalcSettings = function() {
		settings = {};
		settingsAvailable.forEach(function(elem) {
			if (elem !== 'SoundLevel') {
				settings[elem] = 0;
			} else {
				settings[elem] = 0.8;
			}
		});
		
		try {
			settings = JSON.parse(localStorage.getItem('settings') || '');
		} catch (e) {
			// nothing
		}
	};
	
	// устанавливаем настройки при инициализации
	recalcSettings();
	
	// устанавливаем геттеры и сеттеры
	settingsAvailable.forEach(function(elem) {
		self.__defineGetter__(elem, function() {
			// заново получаем на случай, если они изменились за это время
			recalcSettings();
			
			return (typeof settings[elem] !== 'undefined')
				? settings[elem]
				: null;
		});
		
		self.__defineSetter__(elem, function(value) {
			settings[elem] = value;
			localStorage.setItem('settings', JSON.stringify(settings));
		});
	});
};
