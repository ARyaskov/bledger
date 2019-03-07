/*!
 * u2f.js - Ledger U2F communication
 * Copyright (c) 2018, The Bcoin Developers (MIT License).
 * https://github.com/bcoin-org/bcoin
 */
/* eslint-env browser */
'use strict';

const assert = require('bsert');

const U2F = require('u2f-api');
const {sign} = U2F;
const {Lock} = require('bmutex');

const LedgerError = require('../protocol/error');
const {Device, DeviceInfo} = require('./device');

const U2F_VERSION = 'U2F_V2';
const U2F_CHALLENGE = base64ToSafe(Buffer.alloc(32).toString('base64'));

/**
 * U2F Device
 * @alias module:device.U2FDevice
 * @extends {Device}
 */

class U2FDevice extends Device {
  /**
   * Create Ledger U2F device
   * @constructor
   * @param {Object} [options]
   */

  constructor(options) {
    super();

    this.lock = new Lock(false);

    if (options)
      this.set(options);
  }

  /**
   * Set device options
   * @param {Object} options
   */

  set(options) {
    assert(options);
    super.set(options);

    return this;
  }

  /**
   * Checks if the browser supports U2F
   * @throws {LedgerError}
   */

  async open() {
    await U2FDevice.enforceSupport();
  }

  /**
   * Mock function
   */

  async close() {
  }

  /**
   * Exchange APDU command with device
   * Lock
   * @param {Buffer} apdu
   * @returns {Promise<Buffer>} - response data
   * @throws {LedgerError}
   */

  async exchange(apdu) {
    const unlock = await this.lock.lock();

    try {
      return await this._exchange(apdu);
    } finally {
      unlock();
    }
  }

  /**
   * Exchange APDU command with device
   * without lock
   * @param {Buffer} apdu
   * @returns {Promise<Buffer>} - Response data
   */

  async _exchange(apdu) {
    const wrapped = wrapAPDU(apdu, this.scrambleKey);
    const signRequest = {
      version: U2F_VERSION,
      keyHandle: base64ToSafe(wrapped.toString('base64')),
      challenge: U2F_CHALLENGE,
      appId: location.origin
    };

    const {signatureData} = await sign([signRequest], this.timeout / 1000);
    const response = Buffer.from(safeToBase64(signatureData), 'base64');

    return response.slice(5);
  }

  /**
   * List ledger devices
   * @returns {Promise<DeviceInfo[]>}
   * @throws {LedgerError}
   */

  static async getDevices() {
    await this.enforceSupport();

    return [new DeviceInfo()];
  }

  /**
   * wrapper for U2F
   * @returns {Promise<Boolean>}
   */

  static async isSupported() {
    return await U2F.isSupported();
  }

  /**
   * Enforce support
   * @throws {LedgerError}
   */

  static async enforceSupport() {
    const supported = await this.isSupported();

    if (!supported)
      throw new LedgerError('U2F is not supported', U2FDevice);
  }
}

/**
 * Ledger U2F Device info
 * @extends {DeviceInfo}
 */

class U2FDeviceInfo extends DeviceInfo {
}

/*
 * Helpers
 */

/**
 * Wrap APDU
 * @ignore
 * @param {Buffer} apdu
 * @param {Buffer} key
 * @returns {Buffer}
 */

function wrapAPDU(apdu, key) {
  const result = Buffer.alloc(apdu.length);

  for (let i = 0; i < apdu.length; i++)
    result[i] = apdu[i] ^ key[i % key.length];

  return result;
}

/**
 * Convert from normal to web-safe, strip trailing '='s
 * @ignore
 * @param {String} base64
 * @returns {String}
 */

function base64ToSafe(base64) {
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Convert from web-safe to normal, add trailing '='s
 * @ignore
 * @param {String} websafe
 * @returns {String}
 */

function safeToBase64 (websafe) {
  return websafe
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    + '=='.substring(0, (3 * websafe.length) % 4);
}

exports.Device = U2FDevice;
exports.DeviceInfo = U2FDeviceInfo;
