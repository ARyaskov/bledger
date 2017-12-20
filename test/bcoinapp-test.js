
/* eslint-env mocha */
/* eslint prefer-arrow-callback: "off" */

'use strict';

const assert = require('./util/assert');
const utils = require('./util/utils');
const {Device} = require('./util/device');
const LedgerBcoin = require('../lib/bcoin');
const {hashType} = require('../lib/utils/util');

const getTrustedInput = utils.getCommands('data/getTrustedInput.json');
const hashTxStart = utils.getCommands('data/hashTransactionStart.json');
const hashOutputFinalize = utils.getCommands('data/hashOutputFinalize.json');
const hashSign = utils.getCommands('data/hashSign.json');

describe('Bitcoin App', function () {
  let device, bcoinApp;

  beforeEach(() => {
    device = new Device();
    bcoinApp = new LedgerBcoin({ device });
  });

  it('should handle getTrustedInput commands', async () => {
    const {tx, responses, commands} = getTrustedInput;

    device.set({ responses });

    const response = await bcoinApp.getTrustedInput(tx, 1);
    const deviceCommands = device.getCommands();

    assert.bufferEqual(response, responses[12].slice(0, -2));
    assert.strictEqual(deviceCommands.length, commands.length,
      'Number of messages doesn\'t match'
    );

    for (let i = 0; i < deviceCommands.length; i++) {
      assert.bufferEqual(deviceCommands[i], commands[i],
        `Message ${i} wasn't correct`
      );
    }
  });

  it('should handle hashTransactionStart commands', async () => {
    const {data, tx, responses, commands} = hashTxStart;

    device.set({ responses });

    const tis = data.trusted.map(ti => Buffer.from(ti, 'hex'));

    await bcoinApp.hashTransactionStart(tx, 0, tis, true);

    const deviceCommands = device.getCommands();

    assert.strictEqual(deviceCommands.length, commands.length,
      'Number of messages doesn\'t match'
    );

    for (let i = 0; i < deviceCommands.length; i++) {
      assert.bufferEqual(deviceCommands[i], commands[i],
        `Message ${i} wasn't correct`
      );
    }
  });

  it('should handle hashOutputFinalize', async () => {
    const {tx, responses, commands} = hashOutputFinalize;

    device.set({ responses });

    const validations = await bcoinApp.hashOutputFinalize(tx);
    const deviceCommands = device.getCommands();

    for (const [i, deviceCommand] of deviceCommands.entries()) {
      assert.bufferEqual(deviceCommand, commands[i],
        `Message ${i} wasn't correct`
      );
    }

    assert.strictEqual(deviceCommands.length, commands.length,
      'Number of messages doesn\'t match'
    );

    assert.strictEqual(validations.length, 2,
      'There should be 2 user validation requests'
    );

    for (const validation of validations) {
      assert.strictEqual(validation, false,
        'All valdiation requests are false'
      );
    }
  });

  it('should handle hashSign', async () => {
    const {
      tx,
      responses,
      commands,
      data
    } = hashSign;

    device.set({ responses });

    const path = 'm/44\'/0\'/0\'/0/0';
    const sigType = hashType.ALL;

    const signature = await bcoinApp.hashSign(tx, path, sigType);

    const deviceCommands = device.getCommands();

    for (const [i, deviceCommand] of deviceCommands.entries()) {
      assert.bufferEqual(deviceCommand, commands[i],
        `Message ${i} wasn't correct`
      );
    }

    assert.strictEqual(deviceCommands.length, commands.length,
      'Number of messages doesn\'t match'
    );

    assert.bufferEqual(signature, Buffer.from(data.signature, 'hex'),
      'Signature wasn\'t correct'
    );
  });
});
