import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../../../lib/driver';
import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';
import DEFAULT_CAPS from '../../desired';


chai.should();
chai.use(chaiAsPromised);

let assertSource = (source) => {
  source.should.exist;
  let dom = new DOMParser().parseFromString(source);
  let nodes = xpath.select('//android.widget.TextView[@content-desc="App"]', dom);
  nodes.length.should.equal(1);
};

describe('apidemo - source', function () {
  let driver;
  before(async function () {
    driver = new AndroidDriver();
    await driver.createSession(DEFAULT_CAPS);
  });
  after(async function () {
    await driver.deleteSession();
  });
  it('should return the page source', async function () {
    let source = await driver.getPageSource();
    await assertSource(source);
  });
  it('should get less source when compression is enabled', async function () {
    let getSourceWithoutCompression = async () => {
      await driver.updateSettings({ignoreUnimportantViews: false});
      return await driver.getPageSource();
    };
    let getSourceWithCompression = async () => {
      await driver.updateSettings({ignoreUnimportantViews: true});
      return await driver.getPageSource();
    };
    let sourceWithoutCompression = await getSourceWithoutCompression();
    let sourceWithCompression = await getSourceWithCompression();
    sourceWithoutCompression.length.should.be.greaterThan(sourceWithCompression.length);
  });
});
