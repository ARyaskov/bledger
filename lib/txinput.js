/*!
 * bcoin.js - Ledger transaction input
 * Copyright (c) 2017, The Bcoin Developers (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

const assert = require('assert');

const LedgerError = require('./error');
const util = require('./utils/util');

const Network = require('bcoin/lib/protocol/network');
const Outpoint = require('bcoin/lib/primitives/outpoint');
const Coin = require('bcoin/lib/primitives/coin');
const KeyRing = require('bcoin/lib/primitives/keyring');
const TX = require('bcoin/lib/primitives/tx');
const Script = require('bcoin/lib/script').Script;

/**
 * Transactions and outputs
 * to be used for next transaction
 */

class LedgerTXInput {
  /**
   * @constructor
   * @param {Object} options
   * @param {String|Number[]} options.path
   * @param {TX|Buffer} options.tx
   * @param {Number} options.index
   * @param {Script?} options.redeem
   * @param {SighashType?} options.type
   * @param {Buffer?} options.publicKey - raw public key for ring
   */

  constructor(options) {
    this.path = [];
    this.tx = null;
    this.index = 0; // Output index
    this.redeem = null;
    this.type = Script.hashType.ALL;
    this.publicKey = null;

    this._ring = null;
    this._coin = null;
    this._key = '';
    this._prev = null;

    if (options)
      this.fromOptions(options);
  }

  /**
   * Set options for SignInput
   * @param {Object} options
   */

  fromOptions(options) {
    assert(options, 'SignInput data is required.');
    assert(options.path, 'Path is required.');

    if (typeof options.path === 'string')
      options.path = util.parsePath(options.path, true);

    assert(Array.isArray(options.path), 'Path must be Array or string');
    this.path = options.path;

    assert(options.tx, 'Tx is required.');

    if (Buffer.isBuffer(options.tx))
      options.tx = TX.fromRaw(options.tx);

    assert(TX.isTX(options.tx), 'Cannot use non-transaction tx.');
    this.tx = options.tx;

    assert(typeof options.index === 'number', 'Output index is required.');
    assert(isU32(options.index), 'Output index must be a uint32.');
    this.index = options.index;

    if (options.type != null) {
      assert(options.type !== Script.hashType.ALL,
        'Ledger only supports SIGHASH_ALL'
      );

      this.type = options.type;
    }

    if (options.redeem != null) {
      assert(Script.isScript(options.redeem), 'Cannot use non-script redeem.');
      this.redeem = options.redeem;
    }

    if (options.publicKey != null) {
      assert(Buffer.isBuffer(options.publicKey),
        'Cannot set non-buffer public key');
      this.publicKey = options.publicKey;
    }

    return this;
  }

  /**
   * Create SignInput from options
   * @see SignInput#constructor
   * @returns {SignInput}
   */

  static fromOptions(options) {
    return new this().fromOptions(options);
  }

  /**
   * Get Key from prevout
   * @returns {String}
   */

  toKey() {
    if (!this._key)
      this._key = Outpoint.fromTX(this.tx, this.index).toKey();

    return this._key;
  }

  /**
   * Get previous script
   * @returns {Script}
   */

  getPrev() {
    if (!this._prev)
      this._prev = this.tx.outputs[this.index].script;

    return this._prev;
  }

  /**
   * Generate and return coin
   * @param {Number?} [height=0]
   * @param {CoinEntry} coin
   */

  getCoin(height = 0) {
    if (!this._coin)
      this._coin = Coin.fromTX(this.tx, this.index, height);

    return this._coin;
  }

  /**
   * Get ring
   * @param {Network} [network=main]
   * @returns {KeyRing}
   */

  getRing(network = Network.primary) {
    if (!this.publicKey)
      throw new LedgerError('Cannot return ring without public key');

    if (!this._ring) {
      this._ring = KeyRing.fromPublic(this.publicKey, network);

      if (this.redeem)
        this._ring.script = this.redeem;
    }

    return this._ring;
  }

  /**
   * Clear the cache
   */

  refresh() {
    this._coin = null;
    this._ring = null;
    this._key = '';
    this._prev = null;
  }
}

/*
 * Helpers
 */

function isU32(value) {
  return (value >>> 0) === value;
}

module.exports = LedgerTXInput;