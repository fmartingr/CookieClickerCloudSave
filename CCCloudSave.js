/*
 * CookieClickerSync
 * @author Felipe Martin <me@fmartingr.com> @fmartingr
 * 2016
 */

// Add extend function to Object so we can merge associative arrays
Object.extend = function(destination, source) {
  for (var property in source) {
    if (source.hasOwnProperty(property)) {
      destination[property] = source[property];
    }
  }
  return destination;
};

// Addon main object
var CCCloud = {};

// Init config
CCCloud.Config = {
  varName: {
    localStorageBackupKey: 'CCCloud.backupSaveString',
    localStorageKey: 'CCCloud.lastSave',
    remoteStorageKey: 'savegame'
  },
  interval: 30 // Default interval to autosync the game
}

// Internal mod state
CCCloud.State = {
  lastSave: { // Empty last save state to initialize states
    time: 0,
    str: ''
  }
};

// Init providers
CCCloud.Providers = {};
CCCloud.Providers.Firebase = {};
CCCloud.Providers.Firebase.init = function() {
  CCCloud.State._providerLoadFinished = false;
  var script = document.createElement('script');
  script.type = 'text/javascript';
  script.setAttribute('src', 'https://cdn.firebase.com/js/client/2.4.0/firebase.js');
  script.onload = function() {
    CCCloud.State._providerLoadFinished = true;
    CCCloud.State._firebase = new Firebase(CCCloud.Config.providerConf.url);
  };
  document.head.appendChild(script);
};
CCCloud.Providers.Firebase._setKey = function(key, value, callback) {
  CCCloud.State._firebase.child(key).set(value, callback);
};
CCCloud.Providers.Firebase._getKey = function(key, callback) {
  CCCloud.State._firebase.child(key).once('value', function(result) {
    callback(result.val());
  });
};
CCCloud.Providers.Firebase.save = function(data, callback) {
  this._setKey(CCCloud.Config.varName.remoteStorageKey, data, function(error) {
    // TODO handle errors
    if (!error && callback) callback(true);
  })
};
CCCloud.Providers.Firebase.load = function(callback) {
  this._getKey(CCCloud.Config.varName.remoteStorageKey, function(result) {
    // TODO handle errors
    callback(result);
  });
};
CCCloud.Providers.Firebase.testConfig = function(callback) {
  var $provider = this;
  $provider._setKey('_check', "y", function(error) {
    $provider._getKey('_check', function(result) {
      if (result === "y") callback(true);
      else callback(false);
    })
  });
};

// Notifications
CCCloud.Notifications = {};
CCCloud.Notifications.notify = function(content) {
  Game.Notify('CookieClicker Sync', content, null, false);
};
CCCloud.Notifications.quickNotify = function(content) {
  Game.Notify(content, '', null, true);
};

// Interval
CCCloud.Interval = {};
CCCloud.Interval.start = function() {
  if (CCCloud.State._interval) CCCloud.State.stop();
  setInterval(function() { CCCloud.Interval.run() }, CCCloud.Config.interval*1000)
};

CCCloud.Interval.stop = function() {
  if (CCCloud.State._interval) clearInterval(CCCloud.State._interval);
};

CCCloud.Interval.run = function() {
  CCCloud.Save.sync();
  CCCloud.Notifications.quickNotify('Save game synced');
}

// Game save
CCCloud.Save = {};
CCCloud.Save.getForStorage = function(game) {
  return { game: game, time: CCCloud.Utils.getTime() }
}
CCCloud.Save.load = function(save) {
  Game.LoadSave(save.game);
  this._setLastSave(save);
};
CCCloud.Save._setLastSave = function(save) {
  localStorage.setItem(CCCloud.Config.varName.localStorageKey, JSON.stringify(save));
}
CCCloud.Save.get = function() {
  return Game.WriteSave(1);
};
CCCloud.Save.sync = function() {
  var save = this.getForStorage(this.get());
  console.log(save)
  CCCloud.$provider.save(save);
  this._setLastSave(save);
};

// Utils
CCCloud.Utils = {};
CCCloud.Utils.getTime = function() {
  if (!Date.now) {
    // Fix for old browsers. Probably not needed, but...
    return new Date().getTime();
  } else {
    return Date.now();
  }
};

CCCloud.init = function() {
  // Load user configuration
  Object.extend(this.Config, Game.CCCloudSaveConfig);

  // Load provider if configured and present
  if (!this.Config.provider) {
    this.Notifications.notify('Failed to start: Provider not specified.');
    return false;
  }

  if (!(this.Config.provider in this.Providers)) {
    CCCloud.Notifications.notify('Failed to start: Provider ' + this.Config.provider + ' does not exist.');
    return false;
  }

  this.$provider = this.Providers[this.Config.provider];
  this.$provider.init();

  this.State._providerLoadInterval = setInterval(function() {
                                       // TODO Check iterations and break at some point.
                                         if (CCCloud.State._providerLoadFinished) {
                                           clearInterval(CCCloud.State._providerLoadInterval);
                                           CCCloud.State._providerLoadInterval = null;
                                           CCCloud.checkStuff();
                                         }
                                       }, 500);
  return true;
};

CCCloud.checkStuff = function() {
  // Check provider
  this.Providers[this.Config.provider].testConfig(function(success) {
    if (success) {
      CCCloud.start();
      return true;
    } else {
      CCCloud.Notifications.notify('Failed to start: Check your provider configuration.');
      return false;
    }
  });
};

CCCloud.start = function() {
  // Load current epoch time
  this.State.epoch = this.Utils.getTime();

  // Load last synced save (if present)
  var lastSave = localStorage.getItem(this.Config.varName.localStorageKey);
  if (lastSave) {
    this.State.lastSynced = JSON.parse(lastSave);
  }

  // Get provider synced save
  this.$provider.load(function(syncedSave) {
    if (syncedSave && CCCloud.State.lastSynced) {
      // If both local and cloud are available, the newer is used.
      if (syncedSave.time > CCCloud.State.lastSynced.time) {
        CCCloud.Save.load(syncedSave);
      } else {
        CCCloud.$provider.save(CCCloud.State.lastSynced);
      }
    } else if (syncedSave && !CCCloud.State.lastSynced) {
      // If not local save is present but a cloud is
      // Backup current game, just in case!
      localStorage.setItem(CCCloud.Config.varName.localStorageBackupKey, CCCloud.Save.get());
      CCCloud.Save.load(syncedSave);
    } else if (!syncedSave && CCCloud.State.lastSynced) {
      // If not cloud save is present but local is
      CCCloud.$provider.save(CCCloud.Save.getForStorage(CCCloud.State.lastSynced.game));
    } else {
      // If there's no cloud or local save present
      // Backup current game, just in case!
      localStorage.setItem(CCCloud.Config.varName.localStorageBackupKey, CCCloud.Save.get());
      CCCloud.Save.sync();
    }
  })

  // Autosync every Config.timer seconds.
  CCCloud.Interval.start();

  Game.Win('Third-party');

  return true; // Loaded succesfully.
};

// Init mod
CCCloud.init();