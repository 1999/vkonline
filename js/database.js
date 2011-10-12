var AppDatabase = function(dbLink) {
	this._dbLink = dbLink;
	this._userId = null;
};

AppDatabase.prototype.initUser = function(userId, fn) {
	this._userId = userId;
	
	this._dbLink.transaction(function(tx) {
		tx.executeSql('CREATE TABLE IF NOT EXISTS contacts_' + userId + '(uid INTEGER, first_name TEXT, last_name TEXT, other_data TEXT, old_names TEXT, notes TEXT)', [], function() {
			tx.executeSql('CREATE UNIQUE INDEX IF NOT EXISTS unique_uid ON contacts_' + userId + '(uid)', [], function() {
				tx.executeSql('CREATE TABLE IF NOT EXISTS pm_' + userId + '(mtype TEXT, mid INTEGER, uid INTEGER, date INTEGER, title TEXT, body TEXT, other_data TEXT, status INTEGER)', [], function() {
					tx.executeSql('CREATE UNIQUE INDEX IF NOT EXISTS unique_mid ON pm_' + userId + '(mid)', [], function() {
						// attachments column
						tx.executeSql('ALTER TABLE pm_' + userId + ' ADD COLUMN attachments TEXT', [], fn, fn);
					});
				});
			});
		});
	});
};

AppDatabase.prototype.getContactList = function(fn, fnFail) {
	var userId = this._userId;

	this._dbLink.readTransaction(function(tx) {
		tx.executeSql('SELECT rowid, * FROM contacts_' + userId + ' ORDER BY rowid', [], function(tx, resultSet) {
			var i, item, users = {};
			for (i=0; i<resultSet.rows.length; i++) {
				item = resultSet.rows.item(i);
				users[item.uid] = item;
			}
			
			fn(users);
		}, function(tx, err) {
			if (typeof fnFail === 'function') {
				fnFail(err.message);
			}
		});
	});
};

AppDatabase.prototype.getInbox = function(fn, fnFail) {
	var userId = this._userId;
	
	this._dbLink.readTransaction(function(tx) {
		tx.executeSql('SELECT rowid, * FROM pm_' + userId + ' WHERE mtype = "inbox" ORDER BY mid DESC', [], function(tx, resultSet) {
			var i, item, messages = {};
			for (i=0; i<resultSet.rows.length; i++) {
				item = resultSet.rows.item(i);
				messages[item.mid] = item;
			}
			
			fn(messages);
		}, function(tx, err) {
			if (typeof fnFail === 'function') {
				fnFail(err.message);
			}
		});
	});
};

AppDatabase.prototype.getOutbox = function(fn, fnFail) {
	var userId = this._userId;
	
	this._dbLink.readTransaction(function(tx) {
		tx.executeSql('SELECT rowid, * FROM pm_' + userId + ' WHERE mtype = "outbox" ORDER BY mid DESC', [], function(tx, resultSet) {
			var i, item, messages = {};
			for (i=0; i<resultSet.rows.length; i++) {
				item = resultSet.rows.item(i);
				messages[item.mid] = item;
			}
			
			fn(messages);
		}, function(tx, err) {
			if (typeof fnFail === 'function') {
				fnFail(err.message);
			}
		});
	});
};

AppDatabase.prototype.getCorrespondenceNum = function(contactId, fn, fnFail) {
	var userId = this._userId;
	
	this._dbLink.readTransaction(function(tx) {
		tx.executeSql('SELECT COUNT(rowid) AS total FROM pm_' + userId + ' WHERE uid = ?', [contactId], function(tx, resultSet) {
			var total = (resultSet.rows.length)
				? resultSet.rows.item(0).total
				: 0;
			
			fn(total);
		}, function(tx, err) {
			if (typeof fnFail === 'function') {
				fnFail(err.message);
			}
		});
	});
};

AppDatabase.prototype.getCorrespondence = function(contactId, fn, fnFail) {
	var userId = this._userId;
	
	this._dbLink.readTransaction(function(tx) {
		tx.executeSql('SELECT rowid, * FROM pm_' + userId + ' WHERE uid = ? ORDER BY date DESC', [contactId], function(tx, resultSet) {
			var i, messages = [];
			
			for (i=0; i<resultSet.rows.length; i++) {
				messages.push(resultSet.rows.item(i));
			}
			
			fn(messages);
		}, function(tx, err) {
			if (typeof fnFail === 'function') {
				fnFail(err.message);
			}
		});
	});
};


AppDatabase.prototype.insertContact = function(uid, firstName, lastName, otherData, notes, fn, fnFail) {
	var userId = this._userId;
	
	this._dbLink.transaction(function(tx) {
		tx.executeSql('INSERT INTO contacts_' + userId + '(uid, first_name, last_name, other_data, old_names, notes) VALUES(?, ?, ?, ?, "", ?)', [uid, firstName, lastName, otherData, notes], function(tx, resultSet) {
			if (typeof fn === 'function') {
				fn(resultSet.insertId);
			}
		}, function(tx, err) {
			if (typeof fnFail === 'function') {
				fnFail(err.message);
			}
		});
	});
};

AppDatabase.prototype.updateContact = function(uid, firstName, lastName, otherData, notes, fn, fnFail) {
	var userId = this._userId;
	
	this._dbLink.transaction(function(tx) {
		tx.executeSql('UPDATE contacts_' + userId + ' SET first_name = ?, last_name = ?, other_data = ?, old_names = "", notes = ? WHERE uid = ?', [firstName, lastName, otherData, notes, uid], function(tx, resultSet) {
			if (typeof fn === 'function') {
				fn(resultSet.rowsAffected);
			}
		}, function(tx, err) {
			if (typeof fnFail === 'function') {
				fnFail(err.message);
			}
		});
	});
};


AppDatabase.prototype.insertInboxMessage = function(mid, uid, date, title, body, otherData, status, attachmentsInfo, fn, fnFail) {
	var userId = this._userId;
	
	this._dbLink.transaction(function(tx) {
		tx.executeSql('INSERT INTO pm_' + userId + '(mtype, mid, uid, date, title, body, other_data, status, attachments) VALUES("inbox", ?, ?, ?, ?, ?, ?, ?, ?)', [mid, uid, date, title, body, otherData, status, JSON.stringify(attachmentsInfo)], function(tx, resultSet) {
			if (typeof fn === 'function') {
				fn(resultSet.insertId);
			}
		}, function(tx, err) {
			if (typeof fnFail === 'function') {
				fnFail(err.message);
			}
		});
	});
};

AppDatabase.prototype.insertOutboxMessage = function(mid, uid, date, title, body, otherData, status, attachmentsInfo, fn, fnFail) {
	var userId = this._userId;
	
	this._dbLink.transaction(function(tx) {
		tx.executeSql('INSERT INTO pm_' + userId + '(mtype, mid, uid, date, title, body, other_data, status, attachments) VALUES("outbox", ?, ?, ?, ?, ?, ?, ?, ?)', [mid, uid, date, title, body, otherData, status, JSON.stringify(attachmentsInfo)], function(tx, resultSet) {
			if (typeof fn === 'function') {
				fn(resultSet.insertId);
			}
		}, function(tx, err) {
			if (typeof fnFail === 'function') {
				fnFail(err.message);
			}
		});
	});
};

AppDatabase.prototype.markMessageRead = function(mid, fn, fnFail) {
	var userId = this._userId;
	
	this._dbLink.transaction(function(tx) {
		tx.executeSql('UPDATE pm_' + userId + ' SET status = 1 WHERE mid = ?', [mid], function(tx, resultSet) {
			if (typeof fn === 'function') {
				fn(resultSet.rowsAffected);
			}
		}, function(tx, err) {
			if (typeof fnFail === 'function') {
				fnFail(err.message);
			}
		});
	});
};

AppDatabase.prototype.markMessageUnread = function(mid, fn, fnFail) {
	var userId = this._userId;
	
	this._dbLink.transaction(function(tx) {
		tx.executeSql('UPDATE pm_' + userId + ' SET status = 0 WHERE mid = ?', [mid], function(tx, resultSet) {
			if (typeof fn === 'function') {
				fn(resultSet.rowsAffected);
			}
		}, function(tx, err) {
			if (typeof fnFail === 'function') {
				fnFail(err.message);
			}
		});
	});
};

AppDatabase.prototype.deleteMessage = function(mid, fn, fnFail) {	
	var userId = this._userId;
	
	this._dbLink.transaction(function(tx) {
		tx.executeSql('DELETE FROM pm_' + userId + ' WHERE mid = ?', [mid], function(tx, resultSet) {
			if (typeof fn === 'function') {
				fn(resultSet.rowsAffected);
			}
		}, function(tx, err) {
			if (typeof fnFail === 'function') {
				fnFail(err.message);
			}
		});
	}, fnFail);
};
