/**
 * IndexedDB Key/Value Storage
 *
 * @param name {String} this should be a unique name of the db table to be used for the storage (IndexedDBKVStorage
 * will automatically add the u_handle as a suffix, so no need to add that when passing the argument here)
 *
 * @constructor
 */
var IndexedDBKVStorage = function(name) {
    var self = this;
    self.name = name;
    self.db = null;
    self.dbName = null;
    self.logger = new MegaLogger("IDBKVStorage[" + name + "]");
};


/**
 * Internal wrapper/decorator that guarantees that the DB would be available and ready before the `fn` is executed.
 * Uses MegaPromise to always return a proxy promise and while the db is connecting (if that is the case) it will
 * wait and THEN execute the `fn` and link the result (resolve/reject) to the returned proxy promise.
 *
 * @param fn {Function} The function to be executed WHEN the DB is ready. Must return a promise.
 * @returns {MegaPromise}
 * @private
 */

IndexedDBKVStorage._requiresDbConn = function(fn) {
    return function() {
        var self = this;
        var args = arguments;
        var promise = new MegaPromise();

        if (!u_handle) {
            promise.reject();
            return promise;
        }
        if (self.dbName != self.name + "_" + u_handle) {
            if (self.db && self.db.dbState === MegaDB.DB_STATE.INITIALIZED) {
                self.db.close();
            }
            self.db = new MegaDB(
                self.name,
                u_handle,
                {
                    kv: { key: { keyPath: "k"   }}
                },
                {
                    plugins: MegaDB.DB_PLUGIN.ENCRYPTION
                }
            );
            self.dbName = self.name + "_" + u_handle;

            self.db.one('onDbStateReady', function() {
                promise.linkDoneAndFailTo(
                    fn.apply(self, args)
                );
                promise.fail(function() {
                    self.logger.error("Failed to init IndexedDBKVStorage", arguments);
                });
            });
        } else {
            promise.linkDoneAndFailTo(
                fn.apply(self, args)
            );
        }

        return promise;
    }
};

/**
 * Set item
 *
 * @param k {String} A unique key for this value to be stored by. In case that it already exists in the DB it will be
 * replaced (as you would expect from a k/v storage...)
 * @param v {*} Anything can be stored in the KV storage (note: this value will/should be automatically and
 * transparently encrypted by the MegaDBEncryptionPlugin)
 *
 * @returns {MegaPromise}
 */
IndexedDBKVStorage.prototype.setItem = IndexedDBKVStorage._requiresDbConn(function(k, v) {
    var promise = new MegaPromise();

    //console.error("setItem", k, v);

    this.db.addOrUpdate(
        'kv',
        {
            'k': k,
            'v': v
        }
    )
        .done(function() {
            promise.resolve([k, v]);
        })
        .fail(function() {
            promise.reject([k, v]);
        });

    return promise;
});

/**
 * Retrieve item.
 * Note: If the item is NOT found, the returned promise will be rejected.
 *
 * @param k {String} The unique key of the item in the db
 *
 * @returns {MegaPromise}
 */
IndexedDBKVStorage.prototype.getItem = IndexedDBKVStorage._requiresDbConn(function(k) {
    var promise = new MegaPromise();

    this.db.get(
        'kv',
        k
    )
        .done(function(r) {
            if(typeof(r) === 'undefined' || r.length === 0) {
                promise.reject();
            } else {
                promise.resolve(r.v);
            }
        })
        .fail(function() {
            promise.reject();
        });

    return promise;
});

/**
 * Remove item by key
 *
 * @param k {String} The unique key of the item in the db
 *
 * @returns {MegaPromise}
 */
IndexedDBKVStorage.prototype.removeItem = IndexedDBKVStorage._requiresDbConn(function(k) {
    return this.db.remove(
        'kv',
        k
    );
});

/**
 * Clear ALL items from the DB
 *
 * @type {MegaPromise}
 */
IndexedDBKVStorage.prototype.clear = IndexedDBKVStorage._requiresDbConn(function() {
    return this.db.clear(
        'kv'
    );
});

/**
 * Check if item with key `k` exists in the DB.
 * The returned promise will be resolved IF the item exists OR rejected if the item does NOT exist.
 *
 * @param k {String} The unique key of the item in the db
 *
 * @returns {MegaPromise}
 */
IndexedDBKVStorage.prototype.hasItem = IndexedDBKVStorage._requiresDbConn(function(k) {
    var promise = new MegaPromise();
    this.db.get(
        'kv',
        k
    )
        .done(function(r) {
            if(typeof(r) === 'undefined' || r.length === 0) {
                promise.reject();
            } else {
                promise.resolve();
            }
        })
        .fail(function() {
            promise.reject();
        });

    return promise;
});
