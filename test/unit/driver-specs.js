import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import log from '../../lib/logger';
import sinon from 'sinon';
import { helpers, SETTINGS_HELPER_PKG_ID } from '../../lib/android-helpers';
import { withMocks } from '@appium/test-support';
import AndroidDriver from '../../lib/driver';
import ADB from 'appium-adb';
import { errors } from '@appium/base-driver';
import { fs } from '@appium/support';
import { SharedPrefsBuilder } from 'shared-preferences-builder';
import _ from 'lodash';

let driver;
let sandbox = sinon.createSandbox();
let expect = chai.expect;
chai.should();
chai.use(chaiAsPromised);

describe('driver', function () {
  describe('constructor', function () {
    it('should call BaseDriver constructor with opts', function () {
      let driver = new AndroidDriver({foo: 'bar'});
      driver.should.exist;
      driver.opts.foo.should.equal('bar');
    });
    it('should have this.findElOrEls', function () {
      let driver = new AndroidDriver({foo: 'bar'});
      driver.findElOrEls.should.exist;
      driver.findElOrEls.should.be.a('function');
    });
  });

  describe('emulator methods', function () {
    describe('fingerprint', function () {
      it('should be rejected if isEmulator is false', function () {
        let driver = new AndroidDriver();
        sandbox.stub(driver, 'isEmulator').returns(false);
        driver.fingerprint(1111).should.eventually.be.rejectedWith('fingerprint method is only available for emulators');
        driver.isEmulator.calledOnce.should.be.true;
      });
    });
    describe('sendSMS', function () {
      it('sendSMS should be rejected if isEmulator is false', function () {
        let driver = new AndroidDriver();
        sandbox.stub(driver, 'isEmulator').returns(false);
        driver.sendSMS(4509, 'Hello Appium').should.eventually.be.rejectedWith('sendSMS method is only available for emulators');
        driver.isEmulator.calledOnce.should.be.true;
      });
    });
    describe('sensorSet', function () {
      it('sensorSet should be rejected if isEmulator is false', function () {
        let driver = new AndroidDriver();
        sandbox.stub(driver, 'isEmulator').returns(false);
        driver.sensorSet({sensorType: 'light', value: 0}).should.eventually.be.rejectedWith('sensorSet method is only available for emulators');
        driver.isEmulator.calledOnce.should.be.true;
      });
    });
  });
  describe('sharedPreferences', function () {
    driver = new AndroidDriver();
    let adb = new ADB();
    driver.adb = adb;
    let builder = new SharedPrefsBuilder();
    describe('should skip setting sharedPreferences', withMocks({driver}, (mocks) => {
      it('on undefined name', async function () {
        driver.opts.sharedPreferences = {};
        (await driver.setSharedPreferences()).should.be.false;
        mocks.driver.verify();
      });
    }));
    describe('should set sharedPreferences', withMocks({driver, adb, builder, fs}, (mocks) => {
      it('on defined sharedPreferences object', async function () {
        driver.opts.appPackage = 'io.appium.test';
        driver.opts.sharedPreferences = {
          name: 'com.appium.prefs',
          prefs: [{type: 'string', name: 'mystr', value: 'appium rocks!'}]
        };
        mocks.driver.expects('getPrefsBuilder').once().returns(builder);
        mocks.builder.expects('build').once();
        mocks.builder.expects('toFile').once();
        mocks.adb.expects('shell').once()
          .withExactArgs(['mkdir', '-p', '/data/data/io.appium.test/shared_prefs']);
        mocks.adb.expects('push').once()
          .withExactArgs('/tmp/com.appium.prefs.xml', '/data/data/io.appium.test/shared_prefs/com.appium.prefs.xml');
        mocks.fs.expects('exists').once()
          .withExactArgs('/tmp/com.appium.prefs.xml')
          .returns(true);
        mocks.fs.expects('unlink').once()
          .withExactArgs('/tmp/com.appium.prefs.xml');
        await driver.setSharedPreferences();
        mocks.driver.verify();
        mocks.adb.verify();
        mocks.builder.verify();
        mocks.fs.verify();
      });
    }));
  });

  describe('createSession', function () {
    beforeEach(function () {
      driver = new AndroidDriver();
      sandbox.stub(driver, 'checkAppPresent');
      sandbox.stub(driver, 'checkPackagePresent');
      sandbox.stub(driver, 'startAndroidSession');
      sandbox.stub(ADB, 'createADB').callsFake(function (opts) {
        return {
          getDevicesWithRetry () {
            return [
              {udid: 'emulator-1234'},
              {udid: 'rotalume-1337'}
            ];
          },
          getPortFromEmulatorString () {
            return 1234;
          },
          setDeviceId: () => {},
          setEmulatorPort: () => {},
          adbPort: opts.adbPort,
          networkSpeed: () => {},
          getApiLevel: () => 22,
        };
      });
      sandbox.stub(driver.helpers, 'configureApp')
        .withArgs('/path/to/some', '.apk')
        .returns('/path/to/some.apk');
    });
    afterEach(function () {
      sandbox.restore();
    });
    it('should verify device is an emulator', function () {
      driver.opts.avd = 'Nexus_5X_Api_23';
      driver.isEmulator().should.equal(true);
      driver.opts.avd = undefined;
      driver.opts.udid = 'emulator-5554';
      driver.isEmulator().should.equal(true);
      driver.opts.udid = '01234567889';
      driver.isEmulator().should.equal(false);
    });
    it('should get browser package details if browserName is provided', async function () {
      sandbox.spy(helpers, 'getChromePkg');
      await driver.createSession(null, null, {
        firstMatch: [{}],
        alwaysMatch: {
          platformName: 'Android',
          'appium:deviceName': 'device',
          browserName: 'Chrome'
        }
      });
      helpers.getChromePkg.calledOnce.should.be.true;
    });
    it.skip('should check an app is present', async function () {
      await driver.createSession(null, null, {
        firstMatch: [{}],
        alwaysMatch: {
          platformName: 'Android',
          'appium:deviceName': 'device',
          'appium:app': '/path/to/some.apk'
        }
      });
      driver.checkAppPresent.calledOnce.should.be.true;
    });
    it('should check a package is present', async function () {
      await driver.createSession(null, null, {
        firstMatch: [{}],
        alwaysMatch: {
          platformName: 'Android',
          'appium:deviceName': 'device',
          'appium:appPackage': 'some.app.package'
        }
      });
      driver.checkPackagePresent.calledOnce.should.be.true;
    });
    it('should accept a package via the app capability', async function () {
      await driver.createSession(null, null, {
        firstMatch: [{}],
        alwaysMatch: {
          platformName: 'Android',
          'appium:deviceName': 'device',
          'appium:app': 'some.app.package'
        }
      });
      driver.checkPackagePresent.calledOnce.should.be.true;
    });
    it('should add server details to caps', async function () {
      await driver.createSession(null, null, {
        firstMatch: [{}],
        alwaysMatch: {
          platformName: 'Android',
          'appium:deviceName': 'device',
          'appium:appPackage': 'some.app.package'
        }
      });
      driver.caps.webStorageEnabled.should.exist;
    });
    it('should pass along adbPort capability to ADB', async function () {
      await driver.createSession(null, null, {
        firstMatch: [{}],
        alwaysMatch: {
          platformName: 'Android',
          'appium:deviceName': 'device',
          'appium:appPackage': 'some.app.package',
          'appium:adbPort': 1111
        }
      });
      driver.adb.adbPort.should.equal(1111);
    });
    it('should proxy screenshot if nativeWebScreenshot is off', async function () {
      await driver.createSession(null, null, {
        firstMatch: [{}],
        alwaysMatch: {
          platformName: 'Android',
          'appium:deviceName': 'device',
          browserName: 'chrome',
          'appium:nativeWebScreenshot': false
        }
      });
      driver.getProxyAvoidList()
        .some((x) => x[1].toString().includes('/screenshot'))
        .should.be.false;
    });
    it('should not proxy screenshot if nativeWebScreenshot is on', async function () {
      await driver.createSession(null, null, {
        firstMatch: [{}],
        alwaysMatch: {
          platformName: 'Android',
          'appium:deviceName': 'device',
          browserName: 'chrome',
          'appium:nativeWebScreenshot': true
        }
      });
      driver.getProxyAvoidList()
        .some((x) => x[1].toString().includes('/screenshot'))
        .should.be.true;
    });
  });
  describe('deleteSession', function () {
    beforeEach(function () {
      driver = new AndroidDriver();
      driver.caps = {};
      driver.adb = new ADB();
      driver.bootstrap = new helpers.bootstrap(driver.adb);
      sandbox.stub(driver, 'stopChromedriverProxies');
      sandbox.stub(driver.adb, 'setIME');
      sandbox.stub(driver.adb, 'forceStop');
      sandbox.stub(driver.adb, 'goToHome');
      sandbox.stub(driver.adb, 'uninstallApk');
      sandbox.stub(driver.adb, 'stopLogcat');
      sandbox.stub(driver.adb, 'setAnimationState');
      sandbox.stub(driver.adb, 'setDefaultHiddenApiPolicy');
      sandbox.stub(driver.adb, 'getApiLevel').returns(27);
      sandbox.stub(driver.bootstrap, 'shutdown');
      sandbox.spy(log, 'debug');
    });
    afterEach(function () {
      sandbox.restore();
    });
    it('should not do anything if Android Driver has already shut down', async function () {
      driver.bootstrap = null;
      await driver.deleteSession();
      driver.stopChromedriverProxies.called.should.be.false;
      driver.adb.stopLogcat.called.should.be.true;
    });
    it('should call stopLogcat even if skipLogcatCapture is true', async function () {
      driver.opts.skipLogcatCapture = true;
      await driver.deleteSession();
      driver.adb.stopLogcat.called.should.be.true;
    });
    it('should reset keyboard to default IME', async function () {
      driver.opts.unicodeKeyboard = true;
      driver.opts.resetKeyboard = true;
      driver.defaultIME = 'someDefaultIME';
      await driver.deleteSession();
      driver.adb.setIME.calledOnce.should.be.true;
    });
    it('should force stop non-Chrome sessions', async function () {
      await driver.deleteSession();
      driver.adb.forceStop.calledOnce.should.be.true;
    });
    it('should uninstall APK if required', async function () {
      driver.opts.fullReset = true;
      await driver.deleteSession();
      driver.adb.uninstallApk.calledOnce.should.be.true;
    });
    it('should call setAnimationState to enable it with API Level 27', async function () {
      driver._wasWindowAnimationDisabled = true;
      await driver.deleteSession();
      driver.adb.setAnimationState.calledOnce.should.be.true;
      driver.adb.setDefaultHiddenApiPolicy.calledOnce.should.be.false;
    });
    it('should call setAnimationState to enable it with API Level 28', async function () {
      driver._wasWindowAnimationDisabled = true;
      driver.adb.getApiLevel.restore();
      sandbox.stub(driver.adb, 'getApiLevel').returns(28);
      await driver.deleteSession();
      driver.adb.setAnimationState.calledOnce.should.be.true;
      driver.adb.setDefaultHiddenApiPolicy.calledOnce.should.be.true;
    });
    it('should not call setAnimationState', async function () {
      driver._wasWindowAnimationDisabled = false;
      await driver.deleteSession();
      driver.adb.setAnimationState.calledOnce.should.be.false;
      driver.adb.setDefaultHiddenApiPolicy.calledOnce.should.be.false;
    });
  });
  describe('dismissChromeWelcome', function () {
    before(function () {
      driver = new AndroidDriver();
    });
    it('should verify chromeOptions args', function () {
      driver.opts = {};
      driver.shouldDismissChromeWelcome().should.be.false;
      driver.opts = {chromeOptions: {}};
      driver.shouldDismissChromeWelcome().should.be.false;
      driver.opts = {chromeOptions: {args: []}};
      driver.shouldDismissChromeWelcome().should.be.false;
      driver.opts = {chromeOptions: {args: '--no-first-run'}};
      driver.shouldDismissChromeWelcome().should.be.false;
      driver.opts = {chromeOptions: {args: ['--disable-dinosaur-easter-egg']}};
      driver.shouldDismissChromeWelcome().should.be.false;
      driver.opts = {chromeOptions: {args: ['--no-first-run']}};
      driver.shouldDismissChromeWelcome().should.be.true;
    });
  });
  describe('initAUT', withMocks({helpers}, (mocks) => {
    beforeEach(function () {
      driver = new AndroidDriver();
      driver.caps = {};
    });
    it('should throw error if run with full reset', async function () {
      driver.opts = {appPackage: 'app.package', appActivity: 'act', fullReset: true};
      await driver.initAUT().should.be.rejectedWith(/Full reset requires an app capability/);
    });
    it('should reset if run with fast reset', async function () {
      driver.opts = {appPackage: 'app.package', appActivity: 'act', fullReset: false, fastReset: true};
      driver.adb = 'mock_adb';
      mocks.helpers.expects('resetApp').withArgs('mock_adb');
      await driver.initAUT();
      mocks.helpers.verify();
    });
    it('should keep data if run without reset', async function () {
      driver.opts = {appPackage: 'app.package', appActivity: 'act', fullReset: false, fastReset: false};
      mocks.helpers.expects('resetApp').never();
      await driver.initAUT();
      mocks.helpers.verify();
    });
    it('should install "otherApps" if set in capabilities', async function () {
      const otherApps = ['http://URL_FOR/fake/app.apk'];
      const tempApps = ['/path/to/fake/app.apk'];
      driver.opts = {
        appPackage: 'app.package',
        appActivity: 'act',
        fullReset: false,
        fastReset: false,
        otherApps: `["${otherApps[0]}"]`,
      };
      sandbox.stub(driver.helpers, 'configureApp')
        .withArgs(otherApps[0], '.apk')
        .returns(tempApps[0]);
      mocks.helpers.expects('installOtherApks').once().withArgs(tempApps, driver.adb, driver.opts);
      await driver.initAUT();
      mocks.helpers.verify();
    });
    it('should uninstall a package "uninstallOtherPackages" if set in capabilities', async function () {
      const uninstallOtherPackages = 'app.bundle.id1';
      driver.opts = {
        appPackage: 'app.package',
        appActivity: 'act',
        fullReset: false,
        fastReset: false,
        uninstallOtherPackages,
      };
      driver.adb = new ADB();
      sandbox.stub(driver.adb, 'uninstallApk')
        .withArgs('app.bundle.id1')
        .returns(true);
      mocks.helpers.expects('uninstallOtherPackages').once().withArgs(driver.adb, [uninstallOtherPackages], [SETTINGS_HELPER_PKG_ID]);
      await driver.initAUT();
      mocks.helpers.verify();
    });

    it('should uninstall multiple packages "uninstallOtherPackages" if set in capabilities', async function () {
      const uninstallOtherPackages = ['app.bundle.id1', 'app.bundle.id2'];
      driver.opts = {
        appPackage: 'app.package',
        appActivity: 'act',
        fullReset: false,
        fastReset: false,
        uninstallOtherPackages: `["${uninstallOtherPackages[0]}", "${uninstallOtherPackages[1]}"]`,
      };
      driver.adb = new ADB();
      sandbox.stub(driver.adb, 'uninstallApk')
        .returns(true);
      mocks.helpers.expects('uninstallOtherPackages').once().withArgs(driver.adb, uninstallOtherPackages, [SETTINGS_HELPER_PKG_ID]);
      await driver.initAUT();
      mocks.helpers.verify();
    });

    it('get all 3rd party packages', async function () {
      driver.adb = new ADB();
      sandbox.stub(driver.adb, 'shell')
        .returns('package:app.bundle.id1\npackage:io.appium.settings\npackage:io.appium.uiautomator2.server\npackage:io.appium.uiautomator2.server.test\n');
      (await helpers.getThirdPartyPackages(driver.adb, [SETTINGS_HELPER_PKG_ID]))
        .should.eql(['app.bundle.id1', 'io.appium.uiautomator2.server', 'io.appium.uiautomator2.server.test']);
    });

    it('get all 3rd party packages with multiple package filter', async function () {
      driver.adb = new ADB();
      sandbox.stub(driver.adb, 'shell')
        .returns('package:app.bundle.id1\npackage:io.appium.settings\npackage:io.appium.uiautomator2.server\npackage:io.appium.uiautomator2.server.test\n');
      (await helpers.getThirdPartyPackages(driver.adb, [SETTINGS_HELPER_PKG_ID, 'io.appium.uiautomator2.server']))
        .should.eql(['app.bundle.id1', 'io.appium.uiautomator2.server.test']);
    });

    it('get no 3rd party packages', async function () {
      driver.adb = new ADB();
      sandbox.stub(driver.adb, 'shell').throws('');
      (await helpers.getThirdPartyPackages(driver.adb, [SETTINGS_HELPER_PKG_ID]))
        .should.eql([]);
    });
  }));
  describe('startAndroidSession', function () {
    beforeEach(function () {
      driver = new AndroidDriver();
      driver.adb = new ADB();
      driver.bootstrap = new helpers.bootstrap(driver.adb);
      driver.settings = { update () {} };
      driver.caps = {};

      // create a fake bootstrap because we can't mock
      // driver.bootstrap.<whatever> in advance
      let fakeBootstrap = {
        start () {},
        onUnexpectedShutdown: {catch () {}}
      };

      sandbox.stub(helpers, 'initDevice');
      sandbox.stub(helpers, 'unlock');
      sandbox.stub(helpers, 'bootstrap').returns(fakeBootstrap);
      sandbox.stub(driver, 'initAUT');
      sandbox.stub(driver, 'startAUT');
      sandbox.stub(driver, 'defaultWebviewName');
      sandbox.stub(driver, 'setContext');
      sandbox.stub(driver, 'startChromeSession');
      sandbox.stub(driver, 'dismissChromeWelcome');
      sandbox.stub(driver.settings, 'update');
      sandbox.stub(driver.adb, 'getPlatformVersion');
      sandbox.stub(driver.adb, 'getScreenSize');
      sandbox.stub(driver.adb, 'getModel');
      sandbox.stub(driver.adb, 'getManufacturer');
      sandbox.stub(driver.adb, 'getApiLevel').returns(27);
      sandbox.stub(driver.adb, 'setHiddenApiPolicy');
      sandbox.stub(driver.adb, 'setAnimationState');
    });
    afterEach(function () {
      sandbox.restore();
    });
    it('should set actual platform version', async function () {
      await driver.startAndroidSession();
      driver.adb.getPlatformVersion.calledOnce.should.be.true;
    });
    it('should handle chrome sessions', async function () {
      driver.opts.browserName = 'Chrome';
      await driver.startAndroidSession();
      driver.startChromeSession.calledOnce.should.be.true;
    });
    it('should unlock the device', async function () {
      await driver.startAndroidSession();
      helpers.unlock.calledOnce.should.be.true;
    });
    it('should start AUT if auto launching', async function () {
      driver.opts.autoLaunch = true;
      await driver.startAndroidSession();
      driver.startAUT.calledOnce.should.be.true;
    });
    it('should not start AUT if not auto launching', async function () {
      driver.opts.autoLaunch = false;
      await driver.startAndroidSession();
      driver.startAUT.calledOnce.should.be.false;
    });
    it('should set the context if autoWebview is requested', async function () {
      driver.opts.autoWebview = true;
      await driver.startAndroidSession();
      driver.defaultWebviewName.calledOnce.should.be.true;
      driver.setContext.calledOnce.should.be.true;
    });
    it('should set the context if autoWebview is requested using timeout', async function () {
      driver.setContext.onCall(0).throws(errors.NoSuchContextError);
      driver.setContext.onCall(1).returns();

      driver.opts.autoWebview = true;
      driver.opts.autoWebviewTimeout = 5000;
      await driver.startAndroidSession();
      driver.defaultWebviewName.calledOnce.should.be.true;
      driver.setContext.calledTwice.should.be.true;
    });
    it('should respect timeout if autoWebview is requested', async function () {
      this.timeout(10000);
      driver.setContext.throws(new errors.NoSuchContextError());

      let begin = Date.now();

      driver.opts.autoWebview = true;
      driver.opts.autoWebviewTimeout = 5000;
      await driver.startAndroidSession().should.eventually.be.rejected;
      driver.defaultWebviewName.calledOnce.should.be.true;

      // we have a timeout of 5000ms, retrying on 500ms, so expect 10 times
      driver.setContext.callCount.should.equal(10);

      let end = Date.now();
      (end - begin).should.be.above(4500);
    });
    it('should not set the context if autoWebview is not requested', async function () {
      await driver.startAndroidSession();
      driver.defaultWebviewName.calledOnce.should.be.false;
      driver.setContext.calledOnce.should.be.false;
    });
    it('should set ignoreUnimportantViews cap', async function () {
      driver.opts.ignoreUnimportantViews = true;

      await driver.startAndroidSession();
      driver.settings.update.calledOnce.should.be.true;
      driver.settings.update.firstCall.args[0].ignoreUnimportantViews.should.be.true;
    });
    it('should not call dismissChromeWelcome on missing chromeOptions', async function () {
      driver.opts.browserName = 'Chrome';
      await driver.startAndroidSession();
      driver.dismissChromeWelcome.calledOnce.should.be.false;
    });
    it('should call setAnimationState with API level 27', async function () {
      driver.opts.disableWindowAnimation = true;
      sandbox.stub(driver.adb, 'isAnimationOn').returns(true);

      await driver.startAndroidSession();
      driver.adb.isAnimationOn.calledOnce.should.be.true;
      driver.adb.setHiddenApiPolicy.calledOnce.should.be.false;
      driver.adb.setAnimationState.calledOnce.should.be.true;
    });
    it('should call setAnimationState with API level 28', async function () {
      driver.opts.disableWindowAnimation = true;
      sandbox.stub(driver.adb, 'isAnimationOn').returns(true);
      driver.adb.getApiLevel.restore();
      sandbox.stub(driver.adb, 'getApiLevel').returns(28);

      await driver.startAndroidSession();
      driver.adb.isAnimationOn.calledOnce.should.be.true;
      driver.adb.setHiddenApiPolicy.calledOnce.should.be.true;
      driver.adb.setAnimationState.calledOnce.should.be.true;
    });
    it('should not call setAnimationState', async function () {
      driver.opts.disableWindowAnimation = true;
      sandbox.stub(driver.adb, 'isAnimationOn').returns(false);

      await driver.startAndroidSession();
      driver.adb.isAnimationOn.calledOnce.should.be.true;
      driver.adb.setHiddenApiPolicy.calledOnce.should.be.false;
      driver.adb.setAnimationState.calledOnce.should.be.false;
    });
  });
  describe('startChromeSession', function () {
    beforeEach(function () {
      driver = new AndroidDriver();
      driver.adb = new ADB();
      driver.bootstrap = new helpers.bootstrap(driver.adb);
      driver.settings = { update () { } };
      driver.caps = {};

      sandbox.stub(driver, 'setupNewChromedriver').returns({
        on: _.noop,
        proxyReq: _.noop,
        jwproxy: {
          command: _.noop
        }
      });
      sandbox.stub(driver, 'dismissChromeWelcome');
    });
    afterEach(function () {
      sandbox.restore();
    });
    it('should call dismissChromeWelcome', async function () {
      driver.opts.browserName = 'Chrome';
      driver.opts.chromeOptions = {
        'args': ['--no-first-run']
      };
      await driver.startChromeSession();
      driver.dismissChromeWelcome.calledOnce.should.be.true;
    });
  });
  describe('validateDesiredCaps', function () {
    before(function () {
      driver = new AndroidDriver();
    });
    it('should throw an error if caps do not contain an app, package or valid browser', function () {
      expect(() => {
        driver.validateDesiredCaps({platformName: 'Android', deviceName: 'device'});
      }).to.throw(/must include/);
      expect(() => {
        driver.validateDesiredCaps({platformName: 'Android', deviceName: 'device', browserName: 'Netscape Navigator'});
      }).to.throw(/must include/);
    });
    it('should not throw an error if caps contain an app, package or valid browser', function () {
      expect(() => {
        driver.validateDesiredCaps({platformName: 'Android', deviceName: 'device', app: '/path/to/some.apk'});
      }).to.not.throw(Error);
      expect(() => {
        driver.validateDesiredCaps({platformName: 'Android', deviceName: 'device', browserName: 'Chrome'});
      }).to.not.throw(Error);
      expect(() => {
        driver.validateDesiredCaps({platformName: 'Android', deviceName: 'device', appPackage: 'some.app.package'});
      }).to.not.throw(/must include/);
    });
    it('should not be sensitive to platform name casing', function () {
      expect(() => {
        driver.validateDesiredCaps({platformName: 'AnDrOiD', deviceName: 'device', app: '/path/to/some.apk'});
      }).to.not.throw(Error);
    });
    it('should not throw an error if caps contain both an app and browser, for grid compatibility', function () {
      expect(() => {
        driver.validateDesiredCaps({platformName: 'Android', deviceName: 'device', app: '/path/to/some.apk', browserName: 'iPhone'});
      }).to.not.throw(Error);
    });
    it('should not throw an error if caps contain androidScreenshotPath capability', function () {
      expect(() => {
        driver.validateDesiredCaps({platformName: 'Android', deviceName: 'device', app: '/path/to/some.apk', androidScreenshotPath: '/path/to/screenshotdir'});
      }).to.not.throw(Error);
    });
  });
  describe('proxying', function () {
    before(function () {
      driver = new AndroidDriver();
      driver.sessionId = 'abc';
    });
    describe('#proxyActive', function () {
      it('should exist', function () {
        driver.proxyActive.should.be.an.instanceof(Function);
      });
      it('should return false', function () {
        driver.proxyActive('abc').should.be.false;
      });
      it('should throw an error if session id is wrong', function () {
        (() => { driver.proxyActive('aaa'); }).should.throw;
      });
    });

    describe('#getProxyAvoidList', function () {
      it('should exist', function () {
        driver.getProxyAvoidList.should.be.an.instanceof(Function);
      });
      it('should return jwpProxyAvoid array', function () {
        let avoidList = driver.getProxyAvoidList('abc');
        avoidList.should.be.an.instanceof(Array);
        avoidList.should.eql(driver.jwpProxyAvoid);
      });
      it('should throw an error if session id is wrong', function () {
        (() => { driver.getProxyAvoidList('aaa'); }).should.throw;
      });
    });

    describe('#canProxy', function () {
      it('should exist', function () {
        driver.canProxy.should.be.an.instanceof(Function);
      });
      it('should return false', function () {
        driver.canProxy('abc').should.be.false;
      });
      it('should throw an error if session id is wrong', function () {
        (() => { driver.canProxy('aaa'); }).should.throw;
      });
    });
  });
});
