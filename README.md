Cookie Clicker Sync
===================

Cookie Clicker add-on to sync your save automatically with a custom provider.


## Loading the mod

Add this code to a bookmark on your browser.

``` javascript
javascript: (function () {
    Game.CCCloudSaveConfig = {
        // Read configuration section
    };
    Game.LoadMod('http://fmartingr.neocities.org/cccloud/CCCloudSave.js');
}());
```

## Configuration

Filling the `Game.CCCloudSaveConfig` array is the way of setting up the addon.

- `interval` (default: 30) Number in second for the cloud save to be synced.
- `provider` (default: `null`, **mandatory**) The name of the provider you are going to use to sync your save.
- `providerConf` (default: `null`, **mandatory**) The configuration variables the provider may need.

## Providers

### [Firebase](https://www.firebase.com/)

Firebase is a platform used to make real time apps and as a backend data storage. You need to create an account and a project to get the needed configuration.

Specify `Firebase` as provider name and a `url` in the `providerConf` pointing to your firebase project. You can specify childs directly into the URL.

Example configuration:
``` javascript
Game.CCCloudSaveConfig = {
    provider: 'Firebase',
    providerConf: {
        url: 'http://url.to.your.firebase.app/child/child'
    }
}
```

## Disclaimer

No warranty. If you lose your save or it gets corrupted is not my fault. Always backup first. Do not rely on this. You've been warned.
