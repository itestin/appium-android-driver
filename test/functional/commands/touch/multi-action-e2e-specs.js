import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import _ from 'lodash';
import AndroidDriver from '../../../../lib/driver';
import DEFAULT_CAPS from '../../desired';


chai.should();
chai.use(chaiAsPromised);

let caps = _.defaults({
  appActivity: '.view.SplitTouchView'
}, DEFAULT_CAPS);

describe('apidemo - touch - multi-actions', function () {
  let driver;
  before(async function () {
    driver = new AndroidDriver();
    await driver.createSession(caps);
  });
  after(async function () {
    await driver.deleteSession();
  });
  it('should scroll two different lists', async function () {
    let lists = await driver.findElements('class name', 'android.widget.ListView');
    let leftList = lists[0].ELEMENT;
    let rightList = lists[1].ELEMENT;
    let leftGestures = [
      {action: 'press', options: {element: leftList}},
      {action: 'moveTo', options: {element: leftList, x: 10, y: 0}},
      {action: 'moveTo', options: {element: leftList, x: 10, y: -75}},
      {action: 'moveTo', options: {element: leftList, x: 10, y: -150}}
    ];
    let rightGestures = [
      {action: 'press', options: {element: rightList}},
      {action: 'moveTo', options: {element: rightList, x: 10, y: 0}},
      {action: 'moveTo', options: {element: rightList, x: 10, y: -75}},
      {action: 'moveTo', options: {element: rightList, x: 10, y: -150}}
    ];
    await driver.performMultiAction([leftGestures, rightGestures]);
  });
});
